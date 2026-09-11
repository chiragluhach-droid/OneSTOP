// Gmail and most webmail clients strip hrefs with an unknown scheme, so a link
// straight to `onestop://` renders as a dead button. Emails point at an https
// URL on our own domain instead, and this page performs the handoff.
//
// Android gets an `intent://` URL rather than the bare scheme: Chrome (which is
// what Gmail opens links in) resolves it against the installed package and is
// far more reliable than assigning `location.href = 'onestop://…'`, which it
// often blocks as an unrequested navigation. iOS gets the scheme directly.
const buildAppOpenPage = ({
  scheme,
  path,
  androidPackage,
  label = 'your request',
  fallbackUrl,
  showFallbackImmediately = false,
}) => {
  const schemeLink = `${scheme}://${path}`;

  // S.browser_fallback_url sends Chrome back here with ?fallback=1 when the
  // package isn't installed, instead of showing a raw "can't open page" error.
  const intentLink =
    `intent://${path}#Intent;scheme=${scheme};package=${androidPackage};` +
    `S.browser_fallback_url=${encodeURIComponent(fallbackUrl)};end`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>MR One — Opening the app</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:#f0f2f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
         min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;color:#333}
    .card{max-width:420px;width:100%;background:#fff;border-radius:16px;overflow:hidden;
          box-shadow:0 8px 30px rgba(0,0,0,.12)}
    .hdr{background:#8B1A1A;padding:24px 28px;text-align:center}
    .hdr h1{color:#fff;font-size:20px;font-weight:700}
    .hdr p{color:#f5c6c6;font-size:13px;margin-top:4px}
    .body{padding:32px 28px;text-align:center}
    .spinner{width:42px;height:42px;margin:0 auto 20px;border:3px solid #f0e4e4;
             border-top-color:#8B1A1A;border-radius:50%;animation:spin .8s linear infinite}
    @keyframes spin{to{transform:rotate(360deg)}}
    h2{font-size:17px;font-weight:700;margin-bottom:8px}
    p.msg{font-size:14px;color:#666;line-height:1.6}
    .btn{display:block;width:100%;margin-top:22px;padding:15px;background:#8B1A1A;color:#fff;
         text-decoration:none;border:none;border-radius:999px;font-size:15px;font-weight:700;
         cursor:pointer;font-family:inherit;text-align:center}
    .btn:hover{opacity:.92}
    .steps{margin-top:22px;text-align:left;background:#f8f9fa;border-radius:10px;padding:16px 18px}
    .steps p{font-size:12px;color:#888;text-transform:uppercase;letter-spacing:.5px;
             font-weight:700;margin-bottom:10px}
    .steps ol{margin:0;padding-left:18px}
    .steps li{font-size:13px;color:#555;line-height:1.7}
    .ftr{background:#f8f8f8;padding:14px 28px;border-top:1px solid #eee;text-align:center}
    .ftr p{font-size:12px;color:#aaa}
    [hidden]{display:none!important}
  </style>
</head>
<body>
  <div class="card">
    <div class="hdr">
      <h1>MR One</h1>
      <p>Manav Rachna University</p>
    </div>

    <div class="body">
      <div id="loading"${showFallbackImmediately ? ' hidden' : ''}>
        <div class="spinner"></div>
        <h2>Opening the MR One app…</h2>
        <p class="msg">Taking you to ${label}.</p>
        <a class="btn" id="manual" href="${schemeLink}">Open the app</a>
      </div>

      <div id="fallback"${showFallbackImmediately ? '' : ' hidden'}>
        <h2>The app didn&rsquo;t open</h2>
        <p class="msg">
          This link opens the <strong>MR One</strong> app, which needs to be installed
          on this phone.
        </p>
        <a class="btn" id="retry" href="${schemeLink}">Try again</a>
        <div class="steps">
          <p>If it still doesn&rsquo;t open</p>
          <ol>
            <li>Open this email on your <strong>phone</strong>, not a computer.</li>
            <li>Check the MR One app is installed.</li>
            <li>Or open MR One yourself and go to <strong>Track Requests</strong>.</li>
          </ol>
        </div>
      </div>
    </div>

    <div class="ftr"><p>MR One — Manav Rachna University</p></div>
  </div>

  <script>
    (function () {
      var schemeLink = ${JSON.stringify(schemeLink)};
      var intentLink = ${JSON.stringify(intentLink)};
      var isAndroid = /android/i.test(navigator.userAgent);
      var target = isAndroid ? intentLink : schemeLink;
      var handedOff = false;

      // Point the visible buttons at whichever form this platform needs.
      ['manual', 'retry'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.setAttribute('href', target);
      });

      if (${showFallbackImmediately ? 'true' : 'false'}) return;

      // If the app takes over, this tab is backgrounded — don't flash the fallback.
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden') handedOff = true;
      });
      window.addEventListener('pagehide', function () { handedOff = true; });
      window.addEventListener('blur', function () { handedOff = true; });

      try { window.location.href = target; } catch (e) {}

      // Android with a browser_fallback_url navigates away on its own, so only
      // non-Android needs this to reveal the fallback.
      setTimeout(function () {
        if (handedOff || document.visibilityState === 'hidden') return;
        document.getElementById('loading').hidden = true;
        document.getElementById('fallback').hidden = false;
      }, 2000);
    })();
  </script>
</body>
</html>`;
};

module.exports = { buildAppOpenPage };
