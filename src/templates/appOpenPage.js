// Gmail and most webmail clients strip hrefs with an unknown scheme, so a link
// straight to `onestop://` renders as a dead button. Emails therefore point at
// an https URL on our own domain, and this page hands off to the app.
//
// Handoff is attempted immediately; the fallback only appears if we are still
// on screen a moment later, which means the app did not take over.
const buildAppOpenPage = ({ deepLink, label = 'your request' }) => `<!DOCTYPE html>
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
    .btn{display:block;width:100%;margin-top:24px;padding:15px;background:#8B1A1A;color:#fff;
         text-decoration:none;border:none;border-radius:999px;font-size:15px;font-weight:700;
         cursor:pointer;font-family:inherit}
    .btn:hover{opacity:.92}
    .hint{margin-top:18px;font-size:12px;color:#999;line-height:1.6}
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
      <div id="loading">
        <div class="spinner"></div>
        <h2>Opening the MR One app…</h2>
        <p class="msg">Taking you to ${label}.</p>
      </div>

      <div id="fallback" hidden>
        <h2>Couldn&rsquo;t open the app</h2>
        <p class="msg">
          Make sure the MR One app is installed on this phone, then try again.
          On a computer, open this link on your phone instead.
        </p>
        <button class="btn" id="retry" type="button">Try again</button>
        <p class="hint">
          Already installed? Open MR One manually and go to <strong>Track Requests</strong>.
        </p>
      </div>
    </div>

    <div class="ftr"><p>MR One — Manav Rachna University</p></div>
  </div>

  <script>
    (function () {
      var link = ${JSON.stringify(deepLink)};
      var handedOff = false;

      // If the app takes over, this tab is backgrounded — don't flash the fallback.
      function onHide() { if (document.visibilityState === 'hidden') handedOff = true; }
      document.addEventListener('visibilitychange', onHide);
      window.addEventListener('pagehide', function () { handedOff = true; });

      function open() {
        try { window.location.href = link; } catch (e) {}
      }

      function showFallback() {
        if (handedOff || document.visibilityState === 'hidden') return;
        document.getElementById('loading').hidden = true;
        document.getElementById('fallback').hidden = false;
      }

      document.getElementById('retry').addEventListener('click', open);

      open();
      setTimeout(showFallback, 1600);
    })();
  </script>
</body>
</html>`;

module.exports = { buildAppOpenPage };
