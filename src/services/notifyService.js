const Notification = require('../models/Notification');
const User = require('../models/User');
const Staff = require('../models/Staff');
const { sendPushToTokens, tokensFor } = require('./pushService');

// Every notification in the system goes through here, so that "write the row"
// and "ring the phone" can never drift apart.
//
// Nothing in this file is allowed to throw at its caller. A notification is a
// side channel: a student's request must still resolve even if the row fails to
// write or their phone is unreachable. Failures are logged and swallowed.

/** Unread count for a recipient — this is what the app icon badge shows. */
const unreadCountFor = async ({ user = null, staff = null }) => {
  const filter = user ? { user: user._id || user, isRead: false } : { staff: staff._id || staff, isRead: false };
  return Notification.countDocuments(filter);
};

/**
 * Create the in-app row and push it to every device the person has registered.
 *
 * @param {object}  args
 * @param {object} [args.user]    student document or id
 * @param {object} [args.staff]   staff document or id
 * @param {string}  args.title
 * @param {string}  args.body
 * @param {string} [args.type]
 * @param {object} [args.request] request document or id this is about
 * @param {object} [args.data]    extra payload for tap handling
 * @param {string} [args.channelId]
 */
const notify = async ({
  user = null, staff = null, title, body, type = 'general',
  request = null, data = {}, channelId = 'updates',
}) => {
  if (!user && !staff) return { ok: false, reason: 'no recipient' };
  if (!title || !body) return { ok: false, reason: 'no content' };

  const recipientId = (user || staff)._id || (user || staff);
  const requestId = request ? (request._id || request) : undefined;

  let notification = null;
  try {
    notification = await Notification.create({
      ...(user ? { user: recipientId } : { staff: recipientId }),
      title,
      body,
      type,
      request: requestId,
      data: {
        ...data,
        type,
        ...(requestId ? { requestId: String(requestId) } : {}),
        ...(request?.ticketId ? { ticketId: request.ticketId } : {}),
        audience: user ? 'student' : 'staff',
      },
    });
  } catch (err) {
    console.error('notify: could not record notification:', err.message || err);
    return { ok: false, reason: 'db' };
  }

  try {
    // Reload rather than trusting the caller's document: it may be a lean
    // object, an id, or a copy fetched before the device registered.
    const Model = user ? User : Staff;
    const doc = await Model.findById(recipientId).select('pushTokens expoPushToken').lean();
    const tokens = tokensFor(doc);
    if (!tokens.length) return { ok: true, pushed: 0 };

    const badge = await unreadCountFor(user ? { user: recipientId } : { staff: recipientId });

    const result = await sendPushToTokens(tokens, {
      title,
      body,
      channelId,
      badge,
      data: { ...notification.data, notificationId: String(notification._id) },
    });

    await Notification.updateOne(
      { _id: notification._id },
      result.sent > 0
        ? { pushSentAt: new Date() }
        : { pushError: `0 of ${tokens.length} device(s) accepted` }
    );

    return { ok: true, pushed: result.sent, failed: result.failed };
  } catch (err) {
    console.error('notify: push failed:', err.message || err);
    try {
      await Notification.updateOne({ _id: notification._id }, { pushError: String(err.message || err).slice(0, 300) });
    } catch { /* already logged */ }
    return { ok: true, pushed: 0, reason: 'push' };
  }
};

/** Notify a staff member found by email. Used wherever the workflow only knows an address. */
const notifyStaffByEmail = async (email, payload) => {
  const clean = String(email || '').trim().toLowerCase();
  if (!clean) return { ok: false, reason: 'no email' };

  const staff = await Staff.findOne({ email: clean, isActive: true }).select('_id').lean();
  // Requests are routinely forwarded to addresses with no staff record — those
  // people are reached by email only, which is expected, not an error.
  if (!staff) return { ok: false, reason: 'not a staff account' };

  return notify({ ...payload, staff });
};

/**
 * Fan out to many recipients at once (admin broadcasts).
 *
 * Rows are written with insertMany and the pushes are batched by token, so a
 * 3,500-student broadcast is a handful of round trips rather than 3,500.
 */
const notifyMany = async ({ users = [], staff = [], title, body, type = 'broadcast', data = {} }) => {
  const rows = [
    ...users.map((u) => ({ user: u._id || u })),
    ...staff.map((s) => ({ staff: s._id || s })),
  ].map((who) => ({
    ...who,
    title,
    body,
    type,
    data: { ...data, type, audience: who.user ? 'student' : 'staff' },
  }));

  if (!rows.length) return { recorded: 0, pushed: 0, failed: 0, recipients: 0 };

  let recorded = 0;
  try {
    // ordered:false so one bad row cannot abandon the rest of the broadcast.
    const inserted = await Notification.insertMany(rows, { ordered: false });
    recorded = inserted.length;
  } catch (err) {
    recorded = err?.insertedDocs?.length || 0;
    console.error(`notifyMany: ${rows.length - recorded} row(s) failed to write:`, err.message || err);
  }

  const tokens = [];
  const collect = async (Model, ids) => {
    if (!ids.length) return;
    for (let i = 0; i < ids.length; i += 1000) {
      const docs = await Model.find({ _id: { $in: ids.slice(i, i + 1000) } })
        .select('pushTokens expoPushToken')
        .lean();
      docs.forEach((d) => tokens.push(...tokensFor(d)));
    }
  };

  await collect(User, users.map((u) => u._id || u));
  await collect(Staff, staff.map((s) => s._id || s));

  // A broadcast is one unread item for everybody, but badges are per person and
  // a shared number would be wrong for anyone with a backlog. The app
  // reconciles its own badge from /unread-count when it next opens, so the
  // badge is deliberately left out here rather than set to a misleading value.
  const result = await sendPushToTokens([...new Set(tokens)], {
    title,
    body,
    channelId: 'announcements',
    data: { ...data, type },
  });

  return {
    recipients: rows.length,
    recorded,
    devices: new Set(tokens).size,
    pushed: result.sent,
    failed: result.failed,
  };
};

module.exports = { notify, notifyStaffByEmail, notifyMany, unreadCountFor };
