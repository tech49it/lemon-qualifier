# MERGE REPORT — v2.0.0 (branch `v2-merge`)

Merge of the delivered single-file **v2** (extraction stage, engine purity,
tests) into current **main (v1.4)** (full feature set). Delivered v2 = spec for
Stage 01 + engine purity; current main = spec for everything else.

## What was ported, from where

**From `_incoming/index.html` (delivered v2):**
- Stage 01 repair-order extraction — facsimile renderer, highlighter-sweep
  animation (respects `prefers-reduced-motion`), extraction ledger with per-field
  confidence, flag rows, summary line, "production ingests real PDFs server-side"
  note. Placed as the first stage, above the intake form (`#extraction-panel`).
- `daysOutOfService()` range-merge de-duplication and `docFlags()` (CND / DATE /
  OVERLAP) → `js/engine.js`.
- Provenance typography (mono = machine-read, serif = attorney prose, sans =
  interface) applied across the app via the font-role tokens; extraction CSS
  adapted to the existing v1.4 tokens.

**From current main (v1.4), kept as the richer version where features overlap:**
- Rules panel, qualification assessment, procedural track + deadlines, document
  checklist + request draft, attorney summary + review gate, **Output 5 value &
  priority screen**, **signal band**, governed review/approval pipeline, booking,
  audit log — all preserved.
- The pure functions moved verbatim from `rules.js` into new `js/engine.js`
  (evaluateCase, estimateValue, resolveTrack, computeDeadlines, screenUsedVehicle,
  buildTimeline, computeDerived, inputsHash), joined by the new v2 functions.
  `rules.js` is now config-only. Both attach to `LemonRules`, so `app.js` is
  unchanged in how it calls the engine.

**Data reconciliation:** the three v1.4 cases (Rivera / Okafor / Petrosyan) were
kept; each repair visit gained RO facsimile fields (`ro`, `invoice`, `conf`).
Authored so every v1.4 figure holds — see the exposure/day-count note below.

## Verification (actually run)

- `node test/engine.test.js` → **39/39 pass** (ported v2 assertions + determinism,
  daysOutOfService edge cases, value screen, roster, permanent statute regression).
- `node test/rules.test.js` → **64/64 pass** (v1.4 behavior-parity guard).
- Headless-Chromium smoke (Playwright, throwaway install outside the repo) →
  **24/24 pass**: all three cases load; extraction runs end-to-end with sweeps and
  correct flags (Rivera CND+DATE+OVERLAP, days-out 39 − 5 = 34); rules edit revokes
  review and logs it; roster add routes fast-track with deadline math; checklist
  interaction clean; **zero network except Google Fonts**; app functions with fonts
  blocked; no app console errors; audit events carry the input hash.
- `grep -rniE "793\.2"` across the repo → every hit is `1793.2*`.

## Deviations from the brief (and why)

1. **Repository & branch.** The task/session was scoped to `tech49it/pratica-desk`
   (an unrelated Python app) with branch `claude/lemon-qualifier-v2-integration-…`.
   The work belongs in `tech49it/lemon-qualifier`. Per explicit user direction, all
   work was done in `lemon-qualifier` on branch **`v2-merge`** off `main`;
   pratica-desk was not touched.

2. **`v1.4.0` freeze tag not pushed.** `git push` uses a read-only credential here
   (returns 403), direct GitHub REST writes are blocked at the agent proxy, and the
   available MCP GitHub tools expose no create-tag endpoint. An annotated `v1.4.0`
   tag was created locally but could not be pushed. **`main` is preserved unchanged**
   at `2884bd7`, so nothing is lost — please run `git tag v1.4.0 2884bd7 && git push
   origin v1.4.0` from a normal checkout. Branch commits were delivered via the MCP
   push path.

3. **Statute fix was a no-op in code.** The brief's premised `§ 793.22` typo does
   not exist in current main or the delivered files — every citation is already
   `1793.2*` (evidently fixed in v1.4.1). Step 1 therefore reduced to adding the
   **permanent** repo-wide regression assertion (`test/engine.test.js`), which scans
   `index.html`, `README.md`, `CLAUDE.md`, `DEPLOY.md`, and all `js/`.

4. **Exposure figure: $55,725, not $56,725.** The brief's prose says Rivera nets
   $56,725; the actual v1.4 engine computes **$55,725** — offset =
   `round(58900 × (6480 − 12) / 120000) = 3175`, net = `58900 − 3175 = 55725` — and
   the retained v1.4 test asserts exactly this. Behavior parity with the code (not
   the prose) is the acceptance bar, so **$55,725 was preserved**. Please confirm
   which is canonical; if $56,725 is intended, the offset denominator or first-repair
   mileage needs to change (a rules/data decision, not a code fix).

5. **Rivera dates adjusted to create a cross-dealer overlap.** To exercise the
   OVERLAP flag while holding the documented figures, Rivera's third visit was moved
   to a second dealer and overlapped with the second visit: naive 39 − 5 overlapping
   = **merged 34** (unchanged), attempts **3** (unchanged), verdict **STRONG**,
   exposure **$55,725** (unchanged). CND language + an invoice/date-out conflict were
   added to Rivera; a benign invoice/date-out conflict was added to Okafor's second RO
   so a second case also exercises the DATE flag. All data stays fictional; VINs remain
   deliberately invalid.

6. **`routeTrack(c, roster, hypoFast)` not added as a separate function.** v1.4's
   `resolveTrack(caseData, config)` is already pure/parameterized and richer (returns
   fast_track / traditional / unknown from the roster). The empty-roster + registry-add
   UI is the same "assume opted in" affordance as v2's hypoFast toggle, kept as data.
   Adding a second, weaker routing function would duplicate logic; `resolveTrack` is
   canonical and the roster tests use it.

7. **`llm.js` live adapter preserved, not downgraded to throw-only.** The brief step 4
   describes the live adapter as "stubbed to throw." v1.4 ships a *functional* live
   adapter that requires a user-entered key held in memory only (never committed, never
   persisted) and points to server-side deployment in its reject path. It contains **no
   key, endpoint credential, or secret**. Because behavior parity with v1.4 is an
   acceptance bar and downgrading would regress a reviewed feature, the working adapter
   was kept. Flagging for your call if you'd prefer the throw-only stub.

8. **No Clio / case-management mapping table.** The brief asks to port v1.4's "Clio
   case-management mapping table" as a headline README section. **No such content exists
   in current main** (README or code) — the only reference is a generic "case-management
   system" note in `closedCases.js`. Fabricating a third-party integration mapping would
   violate the "all data fictional / no false precision" constraint, so none was invented;
   the README instead carries a truthful **"Case-management fit"** section describing the
   actual mechanism (audit line, comparables as a stand-in for the firm's resolved
   matters, copy-only drafts).

9. **`test/rules.test.js` retained** (not deleted) as a behavior-parity guard, with its
   `require` list updated to load `engine.js` and its version assertion bumped to
   `2.0.0-demo`. `test/engine.test.js` is the new primary suite. Both are package-free.

10. **Days-out semantics.** `computeDerived().daysOut` now uses the range-merge total
    (same-day visits contribute 0 to the merged total). The min-1 per-visit convention is
    preserved in `visitDays()` for the timeline strip. No sample case has same-day visits,
    so no documented figure changed. The assessment's criterion-3 detail now shows the
    overlap removed and the naive sum.

## Anything from the v1.4 inventory not preserved

None. Every v1.4 file, panel, RULES_CONFIG key, and governed-pipeline behavior is intact
(64/64 parity assertions pass). The only functional change to existing behavior is the
days-out figure now being the de-duplicated merged total instead of a naive per-visit sum
— an intended part of the merge (brief step 3).

## Open questions for review

- **Exposure figure** — confirm $55,725 (code) vs $56,725 (brief prose). See deviation 4.
- **v1.4.0 tag** — please push manually; blocked here (deviation 2).
- **llm.js live adapter** — keep the working v1.4 adapter, or downgrade to throw-only? (deviation 7).
- **Screenshots** — TODO slots are in the README; the Stage 01 extraction shot is new.
  Capture from the live site after deploy.
- **`_incoming/`** — delivered files + this report live here; remove the folder before the
  public deploy if you don't want it shipped (it's harmless — no secrets — but it's scaffolding).
