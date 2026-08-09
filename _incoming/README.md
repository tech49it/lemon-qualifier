# Lemon Law Intake Qualifier — v2 (Demo)

**Live demo:** open `index.html` in a browser. No build step, no backend, no dependencies, zero network.

A working demonstration of a **document-first** intake pipeline for a California lemon law practice. v1 started at the intake form. v2 starts where the firm's actual pain starts: the stack of dealership repair orders.

Built by Andre C ([github.com/tech49it](https://github.com/tech49it)) as a technical demonstration. **Everything in it is demo logic with fictional data. Nothing here is legal advice.**

## What's new in v2

**Stage 01 — Repair order extraction.** Three fictional RO facsimiles process visibly: each field gets highlighter-swept as it lands in the extraction ledger with a confidence score. Low-confidence fields and document anomalies are **flagged for human verification, never silently accepted**. The demo catches, on screen:

- **"Could not duplicate / no fault found"** language — counted as a customer-reported repair attempt and flagged for counsel, because dealership wording should not erase an attempt.
- **Date conflicts** — an invoice date that disagrees with the date-out is queued for verification rather than picked arbitrarily.
- **Overlapping out-of-service days** — ranges across dealers are merged so no day counts twice; the days-out math shows the naive sum, the overlap removed, and the merged total.

In production this stage is a server-side OCR + LLM pipeline ingesting real scanned PDFs and phone photos. The demo renders embedded facsimiles so it runs offline and exposes no backend logic.

**Type encodes provenance.** Monospace = machine-read off a document. Serif = attorney-facing memo prose. Sans = interface. A reviewer can tell at a glance where every value came from.

**Everything downstream is inherited from v1 and carried forward:**

- **The attorneys own the rules.** Every threshold lives in one editable config, tagged "verify with counsel," shipped with illustrative values drawn from the Civ. Code § 1793.22 presumption guideline. Editing bumps the rule version and stamps every output.
- **Human-in-the-loop, everywhere it matters.** The attorney summary is a draft until a person marks it reviewed — and if any case data, rule, or checklist item changes afterward, the review is **revoked automatically**. An approval only covers the inputs it was given.
- **The AB 1755 / SB 26 procedural layer.** Track routing against a manufacturer opt-in roster that **ships empty on purpose** (no verified public roster exists), deadline arithmetic that names which attorney-configured rule controlled, and post-*Rodriguez v. FCA US LLC* (Cal. 2024) screening for used vehicles that asks a question rather than deciding coverage.
- **Audit trail on every output.** Timestamp, rule version, and input hash on every event.
- **Missing-document request drafts** that regenerate from the checklist, never state whether the case qualifies, and leave the panel only via copy-to-clipboard. Nothing transmits.

## Architecture

```
index.html        the entire app — shell, design system, engine, UI
engine_test.js    21 assertions against the pure engine (node engine_test.js)
```

Business logic never touches the DOM. `evaluateCase()`, `daysOutOfService()`, `docFlags()`, and `deadlineMath()` are pure functions — same inputs, same verdict — and run identically in Node for testing.

## Running the tests

```
node engine_test.js
```

Covers: overlap de-duplication arithmetic, verdicts for all three sample cases, CND/date-conflict/overlap flag detection, the *Rodriguez* gate, rule-edit outcome flips, earlier-of deadline logic, and a statute-citation check across the whole file.

## Data handling in production

- All extraction, prompt chains, and rules evaluation run server-side on infrastructure the firm controls. No model keys, prompts, or business logic ship client-side.
- LLM calls use zero-retention API terms; client documents are not used for model training.
- PII/VIN redaction available at ingestion; append-only audit log retained per firm policy.

## Honesty notes

- All names, vehicles, dealers, VINs, and records are fictional.
- Thresholds reference the Song-Beverly Consumer Warranty Act, Civ. Code § 1793.2 et seq., and the Tanner Consumer Protection Act presumption, Civ. Code § 1793.22, as illustrative starting points requiring attorney validation. The app says so on every output.
- Day-counting and attempt-grouping conventions are simplifications marked for counsel review in the source.
