# Partners Demo Script — Lemon Law Intake Qualifier
### 5 minutes. Rehearse with a timer. Stop talking when a beat lands.

**Setup before the meeting:** app open in a clean browser window, Rivera case loaded, rules panel closed, mock mode on. Nothing to type, nothing to log into. If sharing over Zoom, share the window, not the screen.

---

## 0:00 — Frame it (30 sec, before touching anything)

> "I built a working demo of your intake-qualification bottleneck. Not slides — running software. Three things to watch for: the rules are configurable and your attorneys own them, every AI output requires human review before it counts, and everything is audit-trailed. Those aren't features I added for this demo — that's how I build. Same pattern as my email agent that handles about two thousand attorney emails a month."

Don't explain the stack. Nobody asked yet.

## 0:30 — The strong case (60 sec)

Rivera case is already on screen.

**Click nothing yet.** Point at the form: "This is what your intake rep captures — vehicle, warranty, defect, and the repair history row by row. Attempts and days out of service compute automatically." Point at the computed strip: 3 attempts, 34 days.

Point at the verdict: **STRONG CANDIDATE**. Walk the ledger, top to bottom:

> "Safety-defect attempts — met. Days out of service — met. And it's inside the presumption window: first repair at four months, sixty-five hundred miles. Plain English on every line, so the rep understands *why*, not just *what*."

Point at the audit line at the bottom: "Timestamp, rule version, input hash. Every assessment is reconstructable."

## 1:30 — The rules panel (60 sec) — **this is the moment**

Click **Rules — view / edit**.

> "Here's the part I care most about. I'm not a lawyer, and this system doesn't pretend to be one. Every threshold — attempt counts, days, the eighteen-month window — is a config value marked 'verify with counsel.' Your attorneys own these numbers. The system enforces whatever they decide, at intake volume, on every case, consistently."

Change days-out-of-service from 30 to 25. Verdict recomputes live; version stamps `-edited`.

> "Statute changes, case law shifts, your attorneys update a number — nothing gets rebuilt, and the version stamp on every assessment tells you which rules produced it."

Close the panel. (Reload the page after the meeting to reset the edit.)

## 2:30 — Borderline case + checklist (60 sec)

Click **Okafor — electrical drain**. Verdict: **PROMISING — NEEDS DOCUMENTATION**.

> "This is where the tool earns its keep — the messy middle. Three attempts, twenty-one days, warranty unconfirmed. It doesn't guess. It flags exactly what's missing and what the swing factor is — here, whether counsel classifies the defect as safety-related."

Point at the document checklist. Toggle one item missing → requested:

> "The checklist is generated per case — every repair order by date, contract, warranty booklet, manufacturer communications. Your reps chase documents with a list instead of from memory."

## 3:30 — The summary + human gate (60 sec)

Click **Generate draft** in the Attorney intake summary panel.

> "Thirty-second read for the attorney: vehicle, timeline, attempts, days, presumption analysis, recommended next step. It's a draft — the rep edits it, and it doesn't count until a human marks it reviewed."

Edit one word in the textarea. Click **Mark reviewed & save** — point at the Reviewed badge.

> "And if anyone touches the case data after approval, the reviewed status is revoked automatically. An approval only covers the inputs it was given. That's the same human-in-the-loop gate my email agent runs in production — nothing sends, nothing counts, without a person signing off."

## 4:30 — Close (30 sec)

Click **Petrosyan** briefly — LIKELY NOT QUALIFIED — one sentence: "And clear declines get a clear answer with the reason on the record."

Then stop clicking, look at them:

> "This took me [honest number] to build as an outsider with no access to your intake process. Wired into your actual intake — your volume, your criteria, your Filevine — this is qualified cases reaching attorneys faster and reps chasing exactly the right documents. That's the first thing I'd want to sit down with your attorneys and build for real. What does your intake flow look like today?"

End on the question. Their answer tells you what to build next — and turns the demo into a working session.

---

## If they ask…

- **"Is the legal logic right?"** — "The thresholds are the § 793.22 presumption guideline as a starting point, deliberately shipped as demo values for your attorneys to validate. I'd never put screening logic in front of clients that counsel hasn't signed off on — that's why the config is the centerpiece."
- **"What's the stack?"** — "Plain JavaScript, no framework, no backend — right-sized for a demo. Production version: same rules-engine pattern with persistence, roles, and the audit log in a real datastore. I build on GCP/Firebase; I'd fit it to whatever integrates cleanest with Filevine."
- **"Does it use AI?"** — "The summary panel does — behind the human gate. The qualification itself is deliberately deterministic: rules your attorneys set, not a model's opinion. AI where judgment drafts, rules where consistency matters, humans where it counts."
- **"How long to make this real?"** — Don't invent a number. "Depends on your intake flow and Filevine setup — that's discovery, and it's the first conversation I'd want."
