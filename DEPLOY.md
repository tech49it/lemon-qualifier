# DEPLOY.md — getting the site live

The site is public HTML/CSS/JS with zero runtime dependencies. There is a
build step now (`node build.js`, no npm packages involved) — it splits the
source tree into a public landing page and three gated per-firm demo
routes; see [Site structure](README.md#architecture) in the README.

**Rule regardless of option: this stays a standalone project. Do not deploy it
into the Atrium Firebase project or any shared production infrastructure.**

---

## Option 1 — Cloudflare Pages on practicadesk.com (current setup)

The repo ships `.github/workflows/deploy.yml`, which runs `node build.js`
and publishes the resulting `dist/` to Cloudflare Pages on every push to
`main`, via the official `cloudflare/pages-action`.

One-time dashboard/registrar setup (nameservers, Pages project, custom
domain, GitHub secrets, three per-firm Cloudflare Access applications,
HubSpot form) is documented in [`DEPLOY_CHECKLIST.md`](DEPLOY_CHECKLIST.md)
— none of it can be scripted from this repo.

Live at: **https://practicadesk.com** (public landing page); per-firm demo
links are distributed privately and sit behind Cloudflare Access.

### Retired — GitHub Pages

This project previously deployed to `tech49it.github.io/lemon-qualifier`
via GitHub Pages. That's retired in favor of the custom domain above plus
real per-firm access control, since GitHub Pages can't gate a path at all
— it's all-public or nothing.

### Options 2 and 3 below predate the landing-page/gated-demo split

They deploy the raw repo root, which now serves the marketing landing page
at `/` but an unbuilt `demo/app/` template rather than the three stamped,
gated `/demo/<slug>/` routes. Either would need its own `node build.js &&
deploy dist/` step to match the current structure — ask if you want that
wired up; for now, Cloudflare Pages (Option 1) is the one actually kept in
sync with the build.

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
