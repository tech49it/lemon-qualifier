# DEPLOY.md — getting the demo live

The app is pure static files (HTML/CSS/JS, relative paths, no build step), so any
static host serves it as-is. Three options, ranked. All commands run from inside
the `lemon-qualifier/` folder on your machine — your credentials never leave it.

**Rule regardless of option: this stays a standalone project. Do not deploy it
into the Atrium Firebase project or any shared production infrastructure.**

---

## Option 1 — Cloudflare Pages on practicadesk.com (recommended: current setup)

The repo ships `.github/workflows/deploy.yml`, which publishes to Cloudflare
Pages on every push to `main` via the official `cloudflare/pages-action`.
No build step — the workflow deploys the repo root as-is.

One-time dashboard/registrar setup (nameservers, Pages project, custom
domain, GitHub secrets, Cloudflare Access password gate) is documented in
[`DEPLOY_CHECKLIST.md`](DEPLOY_CHECKLIST.md) — none of it can be scripted
from this repo.

Live at: **https://practicadesk.com** (behind Cloudflare Access login)

### Retired — GitHub Pages

This project previously deployed to `tech49it.github.io/lemon-qualifier`
via GitHub Pages. That's being retired in favor of the custom domain above
plus real access control, since GitHub Pages can't password-gate a site.
(Relative asset paths mean the old GitHub Pages URL still works if you ever
re-enable it in repo Settings → Pages, but see step 6 of the checklist.)

## Option 2 — Firebase Hosting (your stack; a talking point in the room)

"Deployed on the same GCP/Firebase stack I run my production platform on."
Create a NEW project for it — do not reuse Atrium's.

```bash
npm install -g firebase-tools        # once, if not installed
firebase login
firebase projects:create lemon-qualifier-demo
firebase use lemon-qualifier-demo
firebase deploy --only hosting
```

`firebase.json` is already in this folder (public dir = `.`, docs excluded,
noindex header so the demo stays out of search engines).

Live at: **https://lemon-qualifier-demo.web.app**

## Option 3 — Vercel

```bash
npm install -g vercel                # once, if not installed
vercel --prod
```

Accept defaults (no build command, output dir `.`). Vercel prints the URL.

---

## After deploy, whichever option

1. Open the live URL on your phone and your laptop — the exact devices that
   might be in the room.
2. Take the three README screenshots from the live site.
3. Put the URL in the repo description and README.
4. In the partners meeting, still run it LOCALLY (open `index.html`) — never
   bet a live demo on conference-room wifi. The URL is the leave-behind, not
   the presentation medium.
