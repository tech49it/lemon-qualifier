# Task: lemon-qualifier — v2.0.0 merge, statute fix, IP notice

You are working in the existing `lemon-qualifier` repository (static site, GitHub Pages at tech49it.github.io/lemon-qualifier, no build step, no dependencies, no package.json). Read `CLAUDE.md` first if present.

## Situation

- `main` currently holds **v1.4.0** — form-based intake with: a signal band (verdict / value tier / exposure / penalty chips), Output 1 qualification assessment, Output 5 case value & priority (buyback exposure arithmetic, exposure review floor, civil-penalty posture factors, fictional comparable outcomes), procedural track with SOL warning intervals, document checklist, attorney summary with review gate + revocation, manufacturer opt-in registry with add UI, audit log.
- Three delivered files sit in `_incoming/`: a single-file **v2** app (`index.html`), its `README.md`, and `engine_test.js` (21 Node assertions). v2 was built from the older v1.2 feature set, so it **lacks** the signal band and Output 5, but **adds** the pieces v1.4 lacks: Stage 01 repair-order extraction (facsimile documents, highlighter-sweep animation, extraction ledger with per-field confidence, flags for CND language / invoice-vs-date-out conflicts / overlapping out-of-service days with range-merge de-duplication), provenance typography (mono = machine-read, serif = attorney memo, sans = interface), a pure `engine.js`-style separation, and a Node test suite.
- A statute citation typo exists in the deployed v1.4 UI and docs: **"§ 793.22" must be "§ 1793.22"** everywhere.

## Objective

Produce **v2.0.0** on a branch: v1.4.0's full feature set + v2's extraction stage, provenance typography, pure engine, and tests — with the statute fix and an all-rights-reserved notice. The delivered v2 file is the **spec for the extraction stage and engine purity**; current `main` is the **spec for everything else**. Where the two implement the same feature (rules panel, assessment, summary gate, audit), keep v1.4's richer version and port v2's improvements into it (corrected cites, provenance fonts, engine extraction).

## Steps

### 0. Safety and inventory
- Tag current main: `git tag v1.4.0 && git push origin v1.4.0`. This freezes what prospects have seen.
- Create branch `v2-merge` off `main`. All work there. Never force-push; never commit to `main`.
- Inventory current `main` before writing anything: list every file, every feature/panel, every rules-config key (including v1.4's value-screen keys: exposure review floor, mileage-offset denominator, SOL intervals, pre-suit notice days, mediation window), and every place business logic touches the DOM. Write this inventory to `_incoming/INVENTORY.md` and commit it — it is the merge checklist.

### 1. Statute citation fix (do this first, standalone commit)
- Sweep the entire repo: `grep -rn "793\.2" .` — every hit of `793.22` or `793.2` that is not `1793.22` / `1793.2` gets the leading `1`. This includes UI strings in JS, HTML footers, README, docs/, and any guide sources.
- Add a regression assertion (kept forever in the test suite): repo-wide, `1793.22` present; no occurrence of `793.22` that is not preceded by `1`.
- Commit as `fix: correct Civ. Code § 1793.22 citation across UI and docs`.

### 2. IP notice (standalone commit)
- No LICENSE file exists and none may be added. Do NOT add MIT/Apache/any OSS license.
- Add to the top of `README.md` and to the app's footer disclaimer line:
  `© Andre Ciasca. Demonstration only — all rights reserved. Not licensed for use, reproduction, or deployment. Production licensing: andre@ciasca.com.`
- Keep the existing "not legal advice / fictional data" language intact; the notice is additive.

### 3. Merge the extraction stage (the core work)
- Port v2's Stage 01 wholesale from `_incoming/index.html`: doc tray, facsimile renderer, highlighter-sweep animation (`prefers-reduced-motion` respected), extraction ledger with confidence scores, flag rows, summary line, and the "production ingests real scanned PDFs server-side" note. Place it as the **first stage**, above the existing intake form.
- Data flow: extraction populates **repair visits, dates, mileage, complaint/correction text** into the case record. Purchase price, contact info, and warranty details remain **intake-entered** fields (they come from the purchase contract, not ROs) and continue to feed Output 5's exposure arithmetic exactly as v1.4 does. Do not fabricate a price-extraction path.
- Sample cases: reconcile v1.4's three cases (Riviera, Okafor, Petrosyan) with v2's RO facsimile data model. Preferred: keep v1.4's cases and personas, and **author RO visit records + facsimile fields for them** consistent with their existing repair histories (attempt counts, days out, dates, mileage must still produce the same verdicts and exposure figures the v1.4 demo and PDF guide show — e.g., Riviera stays STRONG CANDIDATE / FULL BUYBACK CANDIDATE at $55,725 with the default rules). At least one case must exercise each flag type: CND language, invoice/date-out conflict, and an overlapping out-of-service range across two dealers so the merge-dedup math renders. All data stays fictional.
- The days-out figure shown in the assessment must come from v2's `daysOutOfService()` range-merge (naive sum − overlap = total, displayed), replacing any naive summation in v1.4. If the range-merge changes a case's documented days-out figure, adjust that case's visit dates so the documented figure holds — the PDF guide's numbers are the acceptance bar.

### 4. Engine extraction (purity refactor)
- Create `js/engine.js`: all pure functions, zero DOM access — date helpers, `daysOutOfService`, `docFlags`, `evaluateCase`, `deadlineMath`, `routeTrack(c, roster, hypoFast)` (parameterized — no global state reads), **plus v1.4's value-screen math** (exposure = price − mileage offset, tier resolution against the configured floor, civil-penalty factor detection) lifted out of wherever it currently lives.
- `js/rules.js` = config data only. `js/sampleCases.js` = case data only. `js/app.js` = rendering/wiring only. `js/llm.js` = summary generator seam (mock default; live adapter stubbed to throw with a server-side-deployment message; no keys anywhere).
- Plain `<script>` tags in dependency order (rules, sampleCases, engine, llm, app) unless the repo already uses ES modules — match what exists.
- Engine files must load in Node without a DOM (guard any `window`/`document` references out of them entirely).

### 5. Provenance typography
- Adopt v2's font system across the whole app: IBM Plex Mono for every machine-read value, hash, VIN, date, and audit entry; Source Serif 4 for attorney-summary and client-request prose; Libre Franklin for interface. Keep offline fallback stacks. Do not otherwise restyle v1.4's layout — this is a font-role pass, not a redesign.

### 6. Tests
- Create `test/engine.test.js` importing `js/engine.js` + data files directly (no eval/regex extraction — delete that harness pattern from the delivered file).
- Port all 21 delivered assertions, adapting case IDs to the reconciled sample cases. Add:
  - `evaluateCase` determinism (same inputs twice → deep-equal),
  - `daysOutOfService` edge cases: zero visits; fully-nested overlapping ranges,
  - value screen: exposure arithmetic for Riviera equals the documented figure; tier demotes to ATTORNEY REVIEW when the floor is raised above exposure and when price is missing,
  - the statute-cite regression check from step 1 (scans index.html, README.md, all js/, docs/),
  - roster: empty roster routes UNDETERMINED; adding a manufacturer routes it fast-track.
- Runner: `node test/engine.test.js`. No package.json, no dependencies. Document the command in README.

### 7. Docs
- `README.md`: base it on the delivered v2 README, then add v1.4's Output 5 / signal-band / Clio-mapping content (the case-management mapping table is a headline section, not a footnote), the IP notice at top, the live-demo link at the very top, a "v1 → v2" changelog, and screenshot slots marked TODO (screenshots are captured by me, not you).
- `CLAUDE.md`: update to the new file layout and the two standing rules — business logic never touches the DOM; legal copy/citations/disclaimers are reviewed language and must never be altered without explicit instruction.
- `DEPLOY.md`: touch only if the layout changes Pages deployment (it shouldn't).
- Bump displayed version to `rules v2.0.0` and app version strings to v2.0.0.

### 8. Verify (actually run these, don't assume)
- `node test/engine.test.js` — all assertions pass.
- `python3 -m http.server` and click-test: all three cases load → extraction runs end-to-end on each with sweeps and correct flags → signal band and Output 5 figures match v1.4's documented values → rules edit bumps version, recomputes, revokes review → "small case dial" and missing-price behaviors from the PDF guide still work → hypothetical/roster routing renders deadline math → checklist regenerates request draft → audit logs every event with rule version + input hash.
- `grep -rn "793\.2" .` → only `1793.2*` hits.
- No network requests except Google Fonts; app functions with fonts blocked.
- No console errors on any interaction path.

### 9. Finish
- Small conventional commits per step. No PR, no merge to `main`, no tag beyond `v1.4.0`.
- End with `_incoming/MERGE-REPORT.md`: what was ported from each source, any deviation from this brief and why, anything from the v1.4 inventory you could not preserve, and open questions for review.

## Hard constraints

- No frameworks, build steps, bundlers, or npm dependencies — zero-dependency is a sales point.
- Behavior parity: v1.4's documented behaviors (per the live app and its PDF guide) and v2's extraction behaviors are both acceptance bars. If they conflict, stop and record the conflict in MERGE-REPORT.md rather than improvising.
- Never alter legal copy, statute citations (beyond the § 1793.22 fix), disclaimers, "ships empty by design" roster stance, "no penalty amount is ever estimated," or "not a valuation" language.
- No real API keys, endpoints, or credentials anywhere.
- All data stays fictional. Do not generate valid check-digit VINs, real dealer names, or real closed-case data.
