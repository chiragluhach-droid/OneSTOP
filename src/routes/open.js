const express = require('express');
const router = express.Router();
const { buildAppOpenPage } = require('../templates/appOpenPage');

// Must match `expo.scheme` in mobile/app.json.
const APP_SCHEME = process.env.APP_SCHEME || 'onestop';

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

  res
    .status(200)
    // The page is per-request and trivially cheap; caching it would only risk
    // serving a stale deep link.
    .set('Cache-Control', 'no-store')
    .send(buildAppOpenPage({
      deepLink: `${APP_SCHEME}://${target.path}`,
      label: target.label,
    }));
};

router.get('/', openInApp);
router.get('/:target', openInApp);

module.exports = router;
