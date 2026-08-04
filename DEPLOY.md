# DEPLOY.md — getting the demo live

The app is pure static files (HTML/CSS/JS, relative paths, no build step), so any
static host serves it as-is. Three options, ranked. All commands run from inside
the `lemon-qualifier/` folder on your machine — your credentials never leave it.

**Rule regardless of option: this stays a standalone project. Do not deploy it
into the Atrium Firebase project or any shared production infrastructure.**

---

## Option 1 — GitHub Pages (recommended: one push does repo + live URL)

You need the repo on GitHub anyway as portfolio proof. Pages gives you a live
URL from the same push, zero extra accounts, zero config.

```bash
git init
git add .
git commit -m "Lemon Law Intake Qualifier — demo v1"
git branch -M main
git remote add origin https://github.com/tech49it/lemon-qualifier.git
git push -u origin main
```

Then on github.com: repo → Settings → Pages → Source: "Deploy from a branch"
→ branch `main`, folder `/ (root)` → Save.

Live in ~1 minute at: **https://tech49it.github.io/lemon-qualifier/**

(Relative asset paths mean the subdirectory URL just works.)

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
