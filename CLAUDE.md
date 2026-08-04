# CLAUDE.md — Lemon Law Intake Qualifier

Project context for Claude Code. This file is committed and may be public — it
contains project and technical detail only. No personal, salary, or firm-specific
information belongs in here.

## What this is

A working demo of an intake-qualification workflow for a California lemon law
practice. An intake rep captures vehicle, warranty, defect, and repair history;
the app screens the case against configurable Song-Beverly presumption
guidelines and produces four outputs: qualification assessment, procedural
track & deadlines, document checklist, and an attorney-ready intake summary.

It is a portfolio and demonstration piece. All data is fictional. All screening
thresholds are demo values pending attorney validation.

## Status

Deployed and live at https://tech49it.github.io/lemon-qualifier/ — version `1.2.1-demo`, test suite passing (`node test/rules.test.js`, 49/49).

## Stack

Vanilla JavaScript (ES5-compatible), HTML5, CSS3. No framework, no build step,
no runtime dependencies, no backend, no database. Google Fonts with system
fallbacks. Optional OpenAI API call, off by default.

## Architecture

```
index.html            shell: header, toolbar, four panels
css/styles.css        design system, no framework
js/rules.js           RULES_CONFIG + evaluateCase() — pure function, no DOM,
                      no network; runs identically in Node for testing
js/sampleCases.js     three fictional cases + blank template
js/llm.js             summary generator: mock (default) + live OpenAI adapter
js/app.js             UI state and rendering only — zero business logic
firebase.json         Firebase Hosting config (public dir = root, noindex)
DEPLOY.md             deploy commands for GitHub Pages / Firebase / Vercel
```

Separation is strict and must stay strict: qualification logic lives only in
`rules.js`, and `app.js` never makes a screening decision.

## Design invariants — do not break these

1. **Human-in-the-loop.** The AI summary is a draft until a person clicks
   "Mark reviewed & save." Editing any case input after review revokes the
   reviewed state automatically: an approval only covers the inputs it was
   given. No output anywhere presents itself as a decision or as legal advice.
2. **The attorneys own the rules.** Every threshold lives in `RULES_CONFIG`,
   is editable in the UI, and is tagged "verify with counsel." Never hardcode
   a threshold into logic. Never present a threshold as verified statute.
3. **Audit trail.** Every assessment carries timestamp, rule version, and an
   input hash. Editing a rule bumps the version.
4. **Disclaimer on every output panel:** "Demo — preliminary screening only.
   Attorney review required. Rules are illustrative; verify current statute."
5. **Fictional data only.** Never add real names, real dealers, real VINs, or
   anything resembling real client information.
6. **Runs offline.** Mock LLM is the default. The demo must work with no
   network. No API key is ever committed or persisted. Verification links are
   plain anchors — never fetch an external API.
7. **The manufacturer opt-in registry ships empty.** Do not populate it with
   real manufacturer names and opt-in status. No verified public roster exists,
   and a wrong one in a public repo aimed at lemon law attorneys is the exact
   failure this project avoids. The empty state is a feature; say so in the UI.
8. **Deadline output is arithmetic, not opinion.** Every date carries the basis
   string naming which configured rule produced it. Never label a computed date
   as a limitations determination.
9. **Generated client messages request documents only.** The missing-document
   request drafts an email or text asking for the outstanding checklist items and
   nothing else. It never states or implies a qualification outcome, and the demo
   never transmits it — copy-to-clipboard only, no mail-client integration, no
   sending of any kind. It carries the same human-review gate as the summary.
10. **The summary names what counsel must decide; it never decides it.** The
    attorney summary reports the screening result and surfaces the swing factor
    and open items — the questions that belong to a lawyer. It draws no legal
    conclusion, and every summary notes the thresholds are demo values pending
    attorney validation.

## Known simplifications, flagged for counsel review

- Day counting: (date out − date in), same-day visit counts as 1.
- Repair-attempt grouping relies on a per-visit "same primary defect" checkbox
  rather than semantic matching of the reported complaint.
- Used-vehicle and lease coverage is simplified; the warranty answer drives a
  hard gate rather than nuanced analysis.
- The presumption window check uses the first repair visit only.
- AB 1755 / SB 26 intervals are demo values. Public sources disagreed on the
  pre-suit notice operative date (April 1 vs July 1, 2025).
- The Rodriguez used-vehicle screen asks one question and flags it. CPO status
  is an attorney determination the app does not attempt.

These are noted in source comments. Keep them visible rather than quietly
"fixing" them into false precision.

## Do not

- Do not deploy into any existing Firebase project. This gets its own.
- Do not add a build step, framework, or npm dependency to v1. The zero-install
  property is a feature — it means the demo opens from a folder anywhere.
- Do not soften or remove any disclaimer, the audit line, or the review gate.
- Do not add real statute citations presented as verified, or claim the
  screening logic is legally accurate.
- Do not commit an API key, and do not add key persistence to localStorage.
