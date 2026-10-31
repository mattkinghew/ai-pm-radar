# Radar Cloudflare 1033 Recovery (2026-10-18)
Owner screenshot: Error 1033 when opening radar.lamlab.cc behind Access, while Origin localhost 4320 was running.
Diagnosis: no cloudflared process; Edge Access login/302 does not prove authenticated Origin or Tunnel. On 2026-10-18 restarted existing secure npm run tunnel:mobile; cloudflared registered 2026-10-17 17:25 UTC, and fetched remotely configured exact host radar.lamlab.cc→http://127.0.0.1:4320 with Access validation. The connector running on Mac is dependent on Mac uptime and Internet; this is not independent cloud hosting.
Acceptance still needed: Owner cellular Safari Access sign-in and opening Inbox/Archive; if signed-in fails, capture safe HTTP status and verify Host/Access audience/origin. No access token/log secret sharing.
Do not expose helper/Archive/Receiver on the public internet, reconfigure to bypass Access, enable cloud writes, or claim 1033 fixed end-to-end solely from connector registration.
