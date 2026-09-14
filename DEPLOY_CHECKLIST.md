# DEPLOY_CHECKLIST.md — practicadesk.com on Cloudflare Pages

Everything in this repo (workflow, robots.txt, noindex meta tag) is already in
place and will deploy automatically on push to `main` once the pieces below
are set up. These steps need dashboard/registrar access and can't be done
from code.

## 1. Add practicadesk.com to Cloudflare

- Cloudflare dashboard → **Add a site** → enter `practicadesk.com`.
- Pick a plan (Free covers Pages + Access for a handful of users).
- Cloudflare assigns two nameservers.
- At your domain registrar, replace the existing nameservers with the ones
  Cloudflare gave you.
- Wait for the zone to go active (Cloudflare emails you; usually minutes,
  can take up to 24h for DNS to fully propagate).

## 2. Create the Pages project

- Workers & Pages → **Create application** → **Pages**.
- Recommended: **skip** "Connect to Git" here. This repo deploys via the
  `cloudflare/pages-action` GitHub Action (step 4), so the first successful
  Action run will auto-create a Pages project named `lemon-qualifier`.
- If you connect the GitHub repo through the dashboard instead, disable
  automatic builds on push (Settings → Builds & deployments) so the
  dashboard and the Action aren't both deploying on every push — pick one
  path, not both.
- Build settings if the dashboard ever builds it: Framework preset **None**,
  build command **(empty)**, output directory **/** — there's no build
  step, it's static HTML/CSS/JS as-is.

## 3. Set the custom domain

- Pages project → **Custom domains** → **Set up a custom domain** →
  `practicadesk.com` (add `www.practicadesk.com` too if you want it).
- Since the zone is already on Cloudflare, the DNS record is created for
  you automatically.
- Wait a couple minutes for the SSL certificate to issue.

## 4. Add the GitHub Actions secrets

- **Account ID**: Cloudflare dashboard → Workers & Pages overview page,
  right-hand sidebar.
- **API Token**: My Profile → API Tokens → **Create Token** → use the
  "Edit Cloudflare Workers" template or a custom token scoped to
  `Account → Cloudflare Pages → Edit`.
- In the GitHub repo: Settings → Secrets and variables → Actions → New
  repository secret:
  - `CLOUDFLARE_API_TOKEN`
  - `CLOUDFLARE_ACCOUNT_ID`
- Push to `main` (or re-run the workflow) once both secrets are set — that
  first run is what creates the Pages project if you skipped step 2's
  dashboard connect.

## 5. Enable Cloudflare Access (password protection) on the domain

Cloudflare Access, not a static password, is the standard way to gate a
Pages site — it puts a login wall in front of every path.

- Zero Trust dashboard (dash.cloudflare.com → **Zero Trust** → **Access** →
  **Applications**) → **Add an application** → **Self-hosted**.
- Application domain: `practicadesk.com`, path blank (covers the whole site).
- Session duration: however long you want a login to persist (e.g. 24h).
- Choose how visitors authenticate:
  - **One-Time PIN** (closest to a simple gate, no account needed): Settings
    → Authentication → enable the "One-time PIN" login method. Visitors
    enter an email address and get a login code — effectively a
    password-free password prompt.
  - **Restrict to specific people**: in the application's policy, set
    Action **Allow**, Include → **Emails** → list the exact addresses
    allowed in. Combine with One-Time PIN so only those addresses can even
    request a code.
  - Cloudflare Access has no built-in "one shared static password for
    anyone with the link" mode. If you specifically need that (rather than
    email-gated access), that requires a Cloudflare Worker doing HTTP Basic
    Auth in front of the Pages deployment instead of/alongside Access —
    say so if you want that built instead.
- Save the application.
- Test in an incognito window: `https://practicadesk.com` should redirect
  to the Cloudflare Access login page before showing any content.

## 6. Verify

- `https://practicadesk.com` prompts for Access login before rendering
  the app.
- `https://practicadesk.com/robots.txt` returns the disallow-all rules.
- View source on the live page shows `<meta name="robots" content="noindex, nofollow">`.
- In the `tech49it/lemon-qualifier` repo: Settings → Pages → set Source to
  **None** to retire the old `tech49it.github.io/lemon-qualifier` URL, so
  practicadesk.com becomes the one canonical, access-gated host.
