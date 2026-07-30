# Lemon Law Intake Qualifier (Demo)

A working demonstration of an intake-qualification workflow for a California lemon law practice. An intake rep captures a prospective client's vehicle, warranty, defect, and repair history; the system screens the case against configurable Song-Beverly presumption guidelines and produces three outputs: a qualification assessment, a document checklist, and an attorney-ready intake summary.

Built by Andre C ([github.com/tech49it](https://github.com/tech49it)) as a technical demonstration. **Everything in it is demo logic with fictional data. Nothing here is legal advice.**

## Why it's built this way

This demo applies the same design pattern I use in production systems (an AI email agent handling ~2,000 attorney emails/month, and Atrium, a multi-tenant operations platform):

**1. Human-in-the-loop, everywhere it matters.** The AI-generated attorney summary lands in an editable draft field and does not count until a person clicks "Mark reviewed & save." If the underlying case data changes after review, the reviewed status is revoked automatically — an approval only covers the inputs it was given. The summary names the **swing factor** — the single unknown that would change the outcome — and carries the assessment's **open items**, so the attorney reads what counsel must decide, not just a status. No output anywhere in the app presents itself as a decision.

**2. The attorneys own the rules.** Every screening threshold — repair-attempt counts, days out of service, the 18-month/18,000-mile presumption window — lives in one visible config object (`js/rules.js`), editable live in the UI and tagged "verify with counsel." The values shipped here are illustrative demo numbers drawn from the Civil Code § 793.22 presumption guideline; they exist to be replaced by whatever the firm's attorneys decide. The engine enforces their judgment. It doesn't substitute for it.

**3. Audit trail on every output.** Each assessment carries a timestamp, the rule version that produced it, and a hash of the inputs. Editing a rule bumps the version. In production this becomes a full audit log; the line at the bottom of each panel is the visible promise of that.

**4. Runs offline by default.** The LLM summary uses a mock generator so the demo works with zero network. A live-mode toggle calls the OpenAI API for local demonstration only — in any real deployment that call moves behind a server the firm controls, and no key ever ships client-side.

## The procedural layer (v1.1)

California's AB 1755 (signed September 2024) and the cleanup bill SB 26 created
an **opt-in** framework: manufacturers may elect into fast-track procedures.
That put a fork into every intake that did not exist before 2025 — opted-in
manufacturers carry a pre-suit notice requirement, a mediation window, and a
different limitations calculation.

Neither side of that fork requires legal judgment at intake. It is a lookup plus
date arithmetic. So the app does three things:

**Track routing.** Enter the manufacturer, and the system resolves the case to
fast track, traditional, or undetermined. The opt-in roster is a config table
the firm's attorneys maintain — **it ships empty on purpose.** No verified
public roster exists, and guessing at one in a tool aimed at lemon law attorneys
would defeat the point. The empty state says so plainly.

**Deadline arithmetic.** On the fast track, the effective limitations date is
the earlier of two configured rules (years after warranty expiry, or a cap from
delivery). The output names which rule controlled and what the other candidate
was. It is arithmetic on attorney-supplied intervals, labeled as such — not a
limitations opinion.

**Post-Rodriguez screening.** *Rodriguez v. FCA US LLC* (Cal. 2024) narrowed
Song-Beverly coverage for used vehicles. When condition is "used," the form asks
one additional question — was a manufacturer warranty issued at sale — and flags
the case for attorney determination.

**Verification links.** NHTSA recalls and complaints, and the California Bureau
of Automotive Repair, with one-click VIN copy. Plain links, no API calls, no
legal claims.

## What's new in v1.2

**Repair timeline strip.** The qualification panel now draws the repair history
as a horizontal chronology: one shaded bar per completed visit, positioned and
sized by date along an axis running from delivery to today, with the presumption
window marked by a vertical rule. Visits with incomplete dates show as dashed
markers and are called out as excluded from the days-out total. It is pure
rendering of the case data already on screen — the attempt and days-out numbers
below the strip come straight from the same `computeDerived()` the engine uses,
not a second calculation.

**Missing-document request drafts.** A collapsible section in the document
checklist generates a client-ready email or text asking for exactly the items
marked missing or requested — nothing else. It never states or implies whether
the case qualifies, and it carries the same human-review gate as the attorney
summary: the draft is a draft until a person marks it reviewed, and any change
to the checklist or case data revokes that review. **It drafts only — the demo
never transmits anything.** Copy-to-clipboard is the only way text leaves the
panel; there is no mail-client integration and no sending of any kind.

## Architecture

```
index.html            shell, panels, font loading (offline fallbacks)
css/styles.css        design system — no framework
js/rules.js           RULES_CONFIG (the object the attorneys own) +
                      evaluateCase(), a pure function: same inputs, same verdict
js/sampleCases.js     three preloaded fictional cases + blank-case template
js/llm.js             summary generator — mock (default) and live adapters
js/app.js             UI state and rendering only; no business logic
```

No build step, no backend, no dependencies. Business logic never touches the DOM; `evaluateCase()` runs identically in Node for testing.

## Running it

Open `index.html` in a browser. That's it. (Or serve the folder with any static server if you prefer.)

The demo loads with three sample cases — strong candidate, borderline, likely not qualified — so it runs end to end without typing anything:

1. Click a sample case chip. The assessment, checklist, and computed values update live.
2. Click **Rules — view / edit** and change a threshold. The verdict recomputes and the rule version stamps `-edited`.
3. Click **Generate draft** in the Attorney intake summary panel, edit the text, then **Mark reviewed & save**.

## Screenshots

*(placeholders — add after first run)*

- `docs/screenshot-assessment.png` — qualification assessment, strong candidate
- `docs/screenshot-rules.png` — the editable rules panel
- `docs/screenshot-summary.png` — reviewed intake summary

## What v2 would add

Firebase persistence, PDF export of the reviewed summary, and a qualified-vs-declined dashboard (intake KPIs). The rules engine is already isolated, so persistence and reporting bolt on without touching qualification logic.

## Honesty notes

- All names, vehicles, dealers, and records are fictional.
- Threshold values reference the California Civil Code § 793.22 presumption guideline as a starting point only; they are presented as demo logic requiring attorney validation, and the app says so on every output.
- Day-counting and repair-attempt-grouping conventions are simplifications marked for counsel review in the source.
