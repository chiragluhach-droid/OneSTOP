const { Expo } = require('expo-server-sdk');
const User = require('../models/User');
const Staff = require('../models/Staff');

// Delivery goes through Expo's push service, which fans out to FCM (Android)
// and APNs (iOS) using the credentials registered against the EAS project. One
// transport for both platforms means one set of failure modes instead of two,
// and the SDK already handles chunking, receipts and dead-token detection.
//
// The FCM service account and the APNs .p8 live in ../../secrets and are
// uploaded once with `npx eas-cli credentials`; nothing here reads them.
//
// EXPO_ACCESS_TOKEN is optional but recommended: it stops anyone who learns a
// push token from sending notifications that look like they came from us.
const expo = new Expo({
  accessToken: process.env.EXPO_ACCESS_TOKEN || undefined,
  useFcmV1: true,
});

// Expo's own cap per request is 100; the SDK chunks to it anyway.
const RECEIPT_CHUNK = 300;

const isValidToken = (t) => typeof t === 'string' && Expo.isExpoPushToken(t.trim());

/**
 * Every distinct, valid token for a recipient document.
 * Falls back to the legacy single field so a device that registered through an
 * older app build still receives notifications.
 */
const tokensFor = (doc) => {
  if (!doc) return [];
  const all = [
    ...(doc.pushTokens || []).map((t) => t.token),
    doc.expoPushToken,
  ];
  return [...new Set(all.filter(isValidToken).map((t) => t.trim()))];
};

/**
 * Drop a token from whichever account holds it.
 *
 * Called when Expo reports DeviceNotRegistered — the app was uninstalled or the
 * token was rotated, and keeping it means every future send wastes a slot and
 * logs an error.
 */
const forgetToken = async (token) => {
  if (!token) return;
  await Promise.all([
    User.updateMany(
      { $or: [{ 'pushTokens.token': token }, { expoPushToken: token }] },
      { $pull: { pushTokens: { token } }, $unset: { expoPushToken: '' } }
    ),
    Staff.updateMany(
      { $or: [{ 'pushTokens.token': token }, { expoPushToken: token }] },
      { $pull: { pushTokens: { token } }, $unset: { expoPushToken: '' } }
    ),
  ]);
};

/**
 * Check the receipts Expo hands back and prune anything permanently undeliverable.
 *
 * Deliberately not awaited by the caller: a notification is already recorded
 * in the database and visible in the app by this point, so receipt handling is
 * housekeeping and must never slow down or fail a user-facing action.
 */
const reconcileReceipts = async (ticketsWithTokens) => {
  const ids = ticketsWithTokens.filter((t) => t.id).map((t) => t.id);
  if (!ids.length) return;

  const tokenById = new Map(ticketsWithTokens.filter((t) => t.id).map((t) => [t.id, t.token]));

  for (let i = 0; i < ids.length; i += RECEIPT_CHUNK) {
    const chunk = ids.slice(i, i + RECEIPT_CHUNK);
    try {
      const receipts = await expo.getPushNotificationReceiptsAsync(chunk);
      for (const [id, receipt] of Object.entries(receipts)) {
        if (receipt.status !== 'error') continue;
        const code = receipt.details?.error;
        console.warn(`push receipt error (${code || 'unknown'}): ${receipt.message}`);
        if (code === 'DeviceNotRegistered') await forgetToken(tokenById.get(id));
      }
    } catch (err) {
      console.warn('push receipt lookup failed:', err.message || err);
    }
  }
};

/**
 * Send one notification to a set of device tokens.
 *
 * Returns a summary rather than throwing. Push is a best-effort side channel:
 * the in-app notification row is the source of truth, and a resolve or forward
 * must never fail because a phone was unreachable.
 *
 * @param {string[]} tokens
 * @param {object}   payload
 * @param {string}   payload.title
 * @param {string}   payload.body
 * @param {object}  [payload.data]    travels to the app for tap handling
 * @param {number}  [payload.badge]   iOS app-icon number; also used by Android launchers that support counts
 * @param {string}  [payload.channelId] Android channel; see mobile/services/push.js
 */
const sendPushToTokens = async (tokens, { title, body, data = {}, badge, channelId = 'updates' } = {}) => {
  const valid = [...new Set((tokens || []).filter(isValidToken).map((t) => t.trim()))];
  if (!valid.length) return { sent: 0, failed: 0, skipped: true };

  const messages = valid.map((to) => ({
    to,
    title,
    body,
    data,
    sound: 'default',
    channelId,
    priority: 'high',
    // iOS shows a red number; Android launchers that support counts use it too.
    ...(Number.isFinite(badge) ? { badge: Math.max(0, badge) } : {}),
  }));

  let sent = 0;
  let failed = 0;
  const ticketsWithTokens = [];

  for (const chunk of expo.chunkPushNotifications(messages)) {
    try {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      tickets.forEach((ticket, i) => {
        const token = chunk[i].to;
        if (ticket.status === 'ok') {
          sent += 1;
          ticketsWithTokens.push({ id: ticket.id, token });
        } else {
          failed += 1;
          const code = ticket.details?.error;
          console.warn(`push ticket error (${code || 'unknown'}): ${ticket.message}`);
          // Rejected outright — don't keep trying this token forever.
          if (code === 'DeviceNotRegistered') forgetToken(token).catch(() => {});
        }
      });
    } catch (err) {
      failed += chunk.length;
      console.error('push chunk failed:', err.message || err);
    }
  }

  // Fire and forget: see reconcileReceipts.
  if (ticketsWithTokens.length) {
    setImmediate(() => reconcileReceipts(ticketsWithTokens).catch(() => {}));
  }

  return { sent, failed, skipped: false };
};

/**
 * Attach a token to an account, taking it off every other account first.
 *
 * The steal is the important part. Campus devices get shared, and a token left
 * on the previous account would deliver one student's request updates to
 * whoever signed in next — so the newest sign-in always wins.
 */
const registerToken = async ({ token, platform = 'unknown', deviceId, user = null, staff = null }) => {
  const clean = String(token || '').trim();
  if (!isValidToken(clean)) {
    const err = new Error('Not a valid Expo push token');
    err.statusCode = 400;
    throw err;
  }

  const ownerId = (user || staff)?._id;
  const Model = user ? User : Staff;

  await Promise.all([
    User.updateMany(
      { $or: [{ 'pushTokens.token': clean }, { expoPushToken: clean }] },
      { $pull: { pushTokens: { token: clean } }, $unset: { expoPushToken: '' } }
    ),
    Staff.updateMany(
      { $or: [{ 'pushTokens.token': clean }, { expoPushToken: clean }] },
      { $pull: { pushTokens: { token: clean } }, $unset: { expoPushToken: '' } }
    ),
  ]);

  // A reinstall on a known device replaces that device's row rather than
  // leaving a stale one behind next to the new one.
  if (deviceId) {
    await Model.updateOne({ _id: ownerId }, { $pull: { pushTokens: { deviceId } } });
  }

  await Model.updateOne(
    { _id: ownerId },
    {
      $push: { pushTokens: { token: clean, platform, deviceId, lastSeenAt: new Date() } },
      $set: { expoPushToken: clean },
    }
  );

  return clean;
};

/** Detach a token on sign-out, so the next person on this device isn't sent someone else's updates. */
const unregisterToken = async (token) => {
  const clean = String(token || '').trim();
  if (!clean) return;
  await forgetToken(clean);
};

module.exports = {
  sendPushToTokens,
  tokensFor,
  registerToken,
  unregisterToken,
  forgetToken,
  isValidToken,
};
