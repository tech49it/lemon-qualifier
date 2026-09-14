# DEPLOY_CHECKLIST.md — practicadesk.com on Cloudflare Pages

Everything in this repo (build script, workflow, robots.txt, per-firm demo
routes, noindex tags) is already in place. `git push` to `main` builds and
deploys automatically once the pieces below are set up. These steps need
dashboard/registrar access and can't be done from code.

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
  `cloudflare/pages-action` GitHub Action (step 4 below runs `node build.js`
  then publishes `dist/`), so the first successful Action run auto-creates a
  Pages project named `lemon-qualifier`.
- If you connect the GitHub repo through the dashboard instead, disable
  automatic builds on push (Settings → Builds & deployments) so the
  dashboard and the Action aren't both deploying on every push — pick one
  path, not both. If you do let Cloudflare build it: Framework preset
  **None**, build command `node build.js`, output directory `dist`.

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

## 5. Cloudflare Access — three separate applications, one per firm slug

Each firm gets its own Access application so access can be revoked or
re-scoped per firm without touching the others:

- `practicadesk.com/demo/lemonpros*`
- `practicadesk.com/demo/nita*`
- `practicadesk.com/demo/alpha*`

For each, in Zero Trust → **Access** → **Applications** → **Add an
application** → **Self-hosted**:

- Application domain: `practicadesk.com`, path: `/demo/<slug>` (the
  wildcard on the path covers everything under it).
- Session duration: however long you want a login to persist (e.g. 24h).
- Add a policy, Action **Allow**.

**On the two auth options you asked to keep open — read this before you
pick per-firm:**

- **(a) One-Time PIN restricted to a known contact email/domain** — this
  is a real, built-in Access feature. Enable "One-time PIN" as the login
  method, and scope the policy's Include rule to `Emails` (the specific
  contact) or `Email domain` (anyone `@thatfirm.com`). The visitor gets an
  emailed one-time code, no account needed. This works today for any firm
  where you have a contact email.

- **(b) A single shared static password, per firm** — flagging this one:
  Cloudflare Access does not have a "shared password" login method the way
  a `.htpasswd` file does. "Service Auth" in Access is a client-ID/secret
  pair sent as HTTP headers by a *program* (curl, a script) — a person
  can't type it into a browser prompt, so it doesn't give you a password
  box for a firm contact to use. If you genuinely need a literal shared
  password prompt (rather than an emailed code), the way to get that in
  front of a Cloudflare Pages site is a small Cloudflare Worker doing HTTP
  Basic Auth ahead of Access, or in place of it, for that specific path —
  say the word and I'll build it. Otherwise, One-Time PIN is the closest
  built-in equivalent and is what I'd default to per firm.

Decide per firm once you have contact emails confirmed; nothing here
blocks starting with One-Time PIN and switching a given firm's policy
later.

## 6. Create the HubSpot form

- HubSpot → **Marketing** → **Forms** → create the contact/inquiry form.
- Grab its **Portal ID** and **Form ID** (visible in the embed code HubSpot
  gives you, or under the form's settings).
- In `index.html` (the landing page), replace both placeholders:
  - `PORTAL_ID_PLACEHOLDER` (appears twice — script `src` and the
    `data-portal-id` attribute)
  - `FORM_ID_PLACEHOLDER` (the `data-form-id` attribute)
- Commit and push — the workflow rebuilds and redeploys.

## 7. Verify each demo path is actually gated (not a 200)

```bash
curl -I https://practicadesk.com/demo/lemonpros/
curl -I https://practicadesk.com/demo/nita/
curl -I https://practicadesk.com/demo/alpha/
```

Each should come back as a redirect to the Access login/verification page
(302, or 403 if you hit the API directly without a browser) — never a
plain `200`. Also try each in an incognito window: you should see the
Access login screen before any app content renders. If a path 200s
straight through, its Access application isn't correctly scoped to that
path — recheck step 5.

## 8. Verify the landing page contact form

- Load `https://practicadesk.com/`, confirm no login wall (this path is
  intentionally public) and no link anywhere to `/demo/`.
- Submit the HubSpot form with a real test email.
- In HubSpot: Contacts → confirm the new contact was created, and that it
  carries whatever source/campaign properties you configured on the form.

## Also worth doing once live

- `https://practicadesk.com/robots.txt` should return `Disallow: /demo/`
  only — the landing page stays crawlable per Part 4's spec. If you'd
  rather the whole site stayed out of search entirely (including the
  landing page), tell me and I'll change `robots.txt` to `Disallow: /`
  instead — that's a one-line change either way.
- In `tech49it/lemon-qualifier` repo Settings → Pages: set Source to
  **None** to retire the old `tech49it.github.io/lemon-qualifier` URL, so
  practicadesk.com becomes the one canonical host and the demo isn't
  reachable, ungated, at the old address.
