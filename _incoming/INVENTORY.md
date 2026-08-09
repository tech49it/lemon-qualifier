# INVENTORY — current `main` (v1.4) before the v2 merge

Snapshot taken on branch `main` (HEAD commit labeled v1.4.1; internal version
constant `1.4.0-demo`) as the merge checklist. This is the spec for everything
except the extraction stage and engine purity, which come from the delivered
single-file v2 in `_incoming/`.

## Files on main

| File | Role |
|---|---|
| `index.html` | shell: header, toolbar, signal band, intake form, 5 output panels, rules panel, review, booking, audit; `<script>` tags |
| `css/styles.css` | design system (Apple/Tesla monochrome), print styles, topline/signal-band, timeline, value panel |
| `js/rules.js` | `RULES_CONFIG` **plus** the pure engine (evaluateCase, estimateValue, resolveTrack, computeDeadlines, screenUsedVehicle, buildTimeline, computeDerived, inputsHash) — UMD-lite on `LemonRules` |
| `js/sampleCases.js` | 3 fictional cases (Rivera / Okafor / Petrosyan) + `blankCase()` on `LemonSamples` |
| `js/closedCases.js` | fictional closed-case sample + `findComparables()` on `LemonClosed` |
| `js/llm.js` | mock summary + document-request generators; live OpenAI seam; swingFactor; on `LemonLLM` |
| `js/workflow.js` | governed lifecycle FSM, approval guard, booking slots, reviewer roster, lead-source/UTM, append-only audit log on `LemonWorkflow` |
| `js/app.js` | UI state + rendering only (1518 lines); one IIFE |
| `test/rules.test.js` | 64 assertions (no framework) |
| `CLAUDE.md`, `DEPLOY.md`, `README.md` | docs (README was stale at v1.2 content) |
| `firebase.json`, `.gitignore` | hosting config; ignores |
| `docs/screenshot-*.png` | 3 README screenshots |

## Panels / features (must all survive the merge)

- **Signal band (`#topline`)** — 4 chips: Screening verdict, Value tier, Est. net exposure, Penalty factors (present/total). Each jumps to its panel.
- **Intake form (`#intake-form`)** — vehicle/warranty/problem/repairs, lead source + UTM, condition-conditional used-warranty field, computed strip (attempts / days out).
- **Rules panel (`#rules-body`)** — every threshold editable; procedural-track intervals; **manufacturer opt-in registry with add/remove UI** (ships empty); version bump + `-edited` tag on change.
- **Output 1 — Qualification assessment (`#assessment-body`)** — verdict, repair timeline strip, presumption-window line, criteria ledger, flags, audit line.
- **Output 2 — Procedural track & deadlines (`#track-body`)** — track routing, SOL earlier-of math, pre-suit/mediation durations, Rodriguez used-vehicle box, verification links.
- **Output 3 — Document checklist (`#checklist-body`)** — status cycle, VIN copy, verification links, and the missing-document request draft (copy-only).
- **Output 4 — Attorney summary (`#summary-body`)** — mock/live draft, swing factor + open items, human-review gate + auto-revoke.
- **Output 5 — Case value & priority (`#value-body`)** — repurchase exposure (price − mileage offset), tier vs review floor, civil-penalty factor posture (never an amount), fictional comparables.
- **Review & approval (`#review-body`)** — governed FSM (draft → pending → approved / rejected / needs-info), reviewer edits, revoke-on-edit.
- **Booking (`#booking-panel`)** — offered only on APPROVED; guarded in `bookConsultation()`.
- **Audit log (`#audit-body`)** — append-only, seeded historical entries.

## RULES_CONFIG keys (all must be preserved and stay editable)

`version`, `label`, `verifyWithCounsel`; `presumptionWindow{months, miles, note}`;
`criteria{safetyDefectAttempts, sameDefectAttempts, daysOutOfService}` (each
`threshold/label/short`); `promising{attemptsWithin, daysWithin}`; `dayCounting`;
`proceduralTracks{enabled, fastTrack{presuitNoticeDays, mediationWindowDays,
solYearsAfterWarrantyExpiry, solCapYearsFromDelivery}, traditionalTrack, warnDaysBeforeSol}`;
`manufacturerRegistry` (empty); `usedVehicleScreening{enabled, requireManufacturerWarrantyAtSale}`;
`valueScreen{mileageOffsetDenominator, exposureReviewFloor, civilPenaltyFactorLabels{…}}`.

## Business logic that touches the DOM in app.js (refactor notes)

Heavy math already lives in `LemonRules`/`LemonWorkflow`. What was embedded in
`app.js` was classification/threshold mapping mixed into renderers:
value-tier→CSS class (topline + value panel), penalty-factor cutoff (`>= 3`),
deadline "PASSED" wording (`daysRemaining < 0`), window-state→word,
track-status→badge class, `buildChecklist` per-case status seeding, and the
governed-FSM helpers. These are UI wording/state, not screening decisions, and
stay in `app.js`; the screening/valuation/day math is what moved to `engine.js`.

## What v2 adds (from `_incoming/index.html`)

Stage 01 extraction (facsimile, highlighter sweep, ledger with per-field
confidence, CND/DATE/OVERLAP flags, days-out range-merge), provenance
typography, a pure `engine.js`-style separation, and a Node test suite.
