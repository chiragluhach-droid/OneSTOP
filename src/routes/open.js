const express = require('express');
const router = express.Router();
const { buildAppOpenPage } = require('../templates/appOpenPage');

// Must match mobile/app.json — expo.scheme and expo.android.package.
const APP_SCHEME = process.env.APP_SCHEME || 'onestop';
const ANDROID_PACKAGE = process.env.APP_ANDROID_PACKAGE || 'com.mru.onestop';

// Only these may be linked to. An allow-list keeps the URL from being turned
// into a redirector for arbitrary schemes.
const TARGETS = {
  track: { path: 'track', label: 'your request timeline' },
  notifications: { path: 'notifications', label: 'your notifications' },
  dashboard: { path: 'dashboard', label: 'your dashboard' },
};

const openInApp = (req, res) => {
  const key = String(req.params.target || 'track').toLowerCase();
  const target = TARGETS[key] || TARGETS.track;

  // Android's intent:// sends the browser back here with ?fallback=1 when the
  // package isn't installed, so that case renders the guidance immediately
  // rather than spinning again.
  const showFallbackImmediately = req.query.fallback === '1';

  const base = `${req.protocol}://${req.get('host')}${req.baseUrl}/${key}`;

  res
    .status(200)
    // Per-request and trivially cheap; caching only risks a stale deep link.
    .set('Cache-Control', 'no-store')
    .send(buildAppOpenPage({
      scheme: APP_SCHEME,
      path: target.path,
      androidPackage: ANDROID_PACKAGE,
      label: target.label,
      fallbackUrl: `${base}?fallback=1`,
      showFallbackImmediately,
    }));
};

router.get('/', openInApp);
router.get('/:target', openInApp);

module.exports = router;
