/* =========================================================================
 * rules.js — Song-Beverly presumption rules: CONFIG + ENGINE
 *
 * DEMO LOGIC ONLY. Every threshold below is illustrative and must be
 * validated by the firm's attorneys before any real-world use. The point
 * of this file is architectural: the rules live in one visible, editable
 * config object that the firm owns. The engine enforces whatever the
 * attorneys decide — it does not decide for them.
 *
 * No UI code in this file. No legal advice in this file.
 * ========================================================================= */

(function (global) {
  'use strict';

  /* -----------------------------------------------------------------------
   * RULES_CONFIG — the object the firm's attorneys own.
   * Referenced guideline: California Civil Code § 793.22 ("Tanner
   * Consumer Protection Act" presumption). Cited here as the demo's
   * starting point only — VERIFY CURRENT STATUTE WITH COUNSEL.
   * --------------------------------------------------------------------- */
  var RULES_CONFIG = {
    version: '1.0.0-demo',
    label: 'CA Song-Beverly presumption guideline (demo values)',
    verifyWithCounsel: true,

    presumptionWindow: {
      months: 18,          // months from delivery — VERIFY WITH COUNSEL
      miles: 18000,        // miles from delivery — VERIFY WITH COUNSEL
      note: 'Defect must first be presented for repair within this window for the statutory presumption. A claim outside the window may still be viable — attorney judgment, not a rule.'
    },

    criteria: {
      safetyDefectAttempts: {
        threshold: 2,      // VERIFY WITH COUNSEL
        label: 'Repair attempts — defect likely to cause death or serious bodily injury',
        short: 'Safety defect attempts'
      },
      sameDefectAttempts: {
        threshold: 4,      // VERIFY WITH COUNSEL
        label: 'Repair attempts — same nonconformity',
        short: 'Same-defect attempts'
      },
      daysOutOfService: {
        threshold: 30,     // cumulative calendar days — VERIFY WITH COUNSEL
        label: 'Cumulative days out of service',
        short: 'Days out of service'
      }
    },

    /* Proximity margins that promote a miss to "PROMISING — NEEDS
     * DOCUMENTATION". Pure screening heuristics — not statute. */
    promising: {
      attemptsWithin: 1,   // e.g. 3 attempts when threshold is 4
      daysWithin: 10       // e.g. 21 days when threshold is 30
    },

    /* Day-counting convention: (date out − date in), same-day visit = 1.
     * Counting convention itself must be VERIFIED WITH COUNSEL. */
    dayCounting: 'out-minus-in, minimum 1 per visit'
  };

  /* ----------------------------- helpers -------------------------------- */

  function parseDate(s) {
    if (!s) return null;
    var d = new Date(s + 'T00:00:00');
    return isNaN(d.getTime()) ? null : d;
  }

  function monthsBetween(a, b) {
    if (!a || !b) return null;
    var m = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
    if (b.getDate() < a.getDate()) m -= 1;
    return m;
  }

  function visitDays(row) {
    var din = parseDate(row.dateIn);
    var dout = parseDate(row.dateOut);
    if (!din || !dout) return null;
    var diff = Math.round((dout - din) / 86400000);
    if (diff < 0) return null;
    return Math.max(diff, 1); // same-day visit counts as 1 — verify convention with counsel
  }

  /* djb2 hash of the case inputs — powers the audit line */
  function inputsHash(obj) {
    var s = JSON.stringify(obj);
    var h = 5381;
    for (var i = 0; i < s.length; i++) {
      h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    }
    return h.toString(16).padStart(8, '0');
  }

  /* --------------------------- computations ------------------------------ */

  function computeDerived(caseData) {
    var rows = caseData.repairs || [];
    var relevant = rows.filter(function (r) { return r.samePrimaryDefect !== false; });

    var attempts = relevant.length;

    var daysOut = 0;
    var daysUnknown = false;
    relevant.forEach(function (r) {
      var d = visitDays(r);
      if (d === null) { daysUnknown = true; } else { daysOut += d; }
    });

    var first = relevant
      .slice()
      .sort(function (a, b) { return (parseDate(a.dateIn) || Infinity) - (parseDate(b.dateIn) || Infinity); })[0] || null;

    var purchase = parseDate(caseData.vehicle.purchaseDate);
    var firstIn = first ? parseDate(first.dateIn) : null;
    var monthsToFirst = (purchase && firstIn) ? monthsBetween(purchase, firstIn) : null;

    var milesAtPurchase = num(caseData.vehicle.mileageAtPurchase);
    var milesAtFirst = first ? num(first.mileage) : null;
    var milesDelta = (milesAtPurchase !== null && milesAtFirst !== null)
      ? milesAtFirst - milesAtPurchase
      : null;

    return {
      attempts: attempts,
      daysOut: daysOut,
      daysUnknown: daysUnknown,
      monthsToFirstRepair: monthsToFirst,
      milesDeltaAtFirstRepair: milesDelta
    };
  }

  function num(v) {
    if (v === '' || v === null || v === undefined) return null;
    var n = Number(v);
    return isNaN(n) ? null : n;
  }

  /* ----------------------------- evaluator ------------------------------- */

  /**
   * evaluateCase(caseData, config) -> assessment
   * Pure function. No DOM, no network. Same inputs, same output.
   */
  function evaluateCase(caseData, config) {
    var cfg = config || RULES_CONFIG;
    var d = computeDerived(caseData);
    var flags = [];
    var criteria = [];

    /* Presumption window */
    var windowState; // 'met' | 'missed' | 'unknown'
    if (d.monthsToFirstRepair === null || d.milesDeltaAtFirstRepair === null) {
      windowState = 'unknown';
      flags.push('Presumption window cannot be confirmed — missing purchase date, first repair date, or mileage figures.');
    } else if (d.monthsToFirstRepair <= cfg.presumptionWindow.months &&
               d.milesDeltaAtFirstRepair <= cfg.presumptionWindow.miles) {
      windowState = 'met';
    } else {
      windowState = 'missed';
    }

    /* Criterion 1 — safety defect attempts */
    var safety = caseData.problem.safetyRelated; // 'yes' | 'no' | 'unsure'
    var c1met = false;
    var c1detail;
    if (safety === 'yes') {
      c1met = d.attempts >= cfg.criteria.safetyDefectAttempts.threshold;
      c1detail = d.attempts + ' attempt(s) recorded for a safety-related defect (threshold: ' +
        cfg.criteria.safetyDefectAttempts.threshold + '+).';
    } else if (safety === 'unsure') {
      c1detail = 'Safety impact marked "unsure" — criterion not applied. If counsel confirms the defect is safety-related, ' +
        d.attempts + ' attempt(s) would ' +
        (d.attempts >= cfg.criteria.safetyDefectAttempts.threshold ? 'meet' : 'not meet') + ' the threshold.';
      if (d.attempts >= cfg.criteria.safetyDefectAttempts.threshold) {
        flags.push('Safety classification is the swing factor: confirm with attorney whether this defect is likely to cause death or serious bodily injury.');
      }
    } else {
      c1detail = 'Defect not marked as safety-related — criterion not applied.';
    }
    criteria.push({
      id: 'safetyDefectAttempts',
      label: cfg.criteria.safetyDefectAttempts.label,
      met: c1met,
      applicable: safety === 'yes',
      detail: c1detail
    });

    /* Criterion 2 — same-defect attempts */
    var c2met = d.attempts >= cfg.criteria.sameDefectAttempts.threshold;
    criteria.push({
      id: 'sameDefectAttempts',
      label: cfg.criteria.sameDefectAttempts.label,
      met: c2met,
      applicable: true,
      detail: d.attempts + ' attempt(s) recorded (threshold: ' + cfg.criteria.sameDefectAttempts.threshold + '+).'
    });

    /* Criterion 3 — days out of service */
    var c3met = d.daysOut >= cfg.criteria.daysOutOfService.threshold;
    criteria.push({
      id: 'daysOutOfService',
      label: cfg.criteria.daysOutOfService.label,
      met: c3met,
      applicable: true,
      detail: d.daysOut + ' cumulative day(s) out of service (threshold: ' + cfg.criteria.daysOutOfService.threshold + '+).' +
        (d.daysUnknown ? ' Some visits are missing dates — true total may be higher.' : '')
    });

    if (d.daysUnknown) {
      flags.push('One or more repair visits are missing in/out dates — days-out-of-service total is understated.');
    }

    /* Warranty gate */
    var warranty = caseData.warranty.active; // 'yes' | 'no' | 'unsure'
    if (warranty === 'no') {
      flags.push('No active manufacturer warranty reported. Song-Beverly coverage generally turns on the manufacturer\'s new-vehicle warranty — used vehicles may still qualify if the defect arose within the original warranty. Attorney review required.');
    } else if (warranty === 'unsure') {
      flags.push('Warranty status unconfirmed — request the warranty booklet and in-service date before attorney review.');
    }

    /* Verdict */
    var anyMet = c1met || c2met || c3met;
    var nearMiss =
      (d.attempts >= cfg.criteria.sameDefectAttempts.threshold - cfg.promising.attemptsWithin) ||
      (d.daysOut >= cfg.criteria.daysOutOfService.threshold - cfg.promising.daysWithin) ||
      (safety === 'unsure' && d.attempts >= cfg.criteria.safetyDefectAttempts.threshold);

    var verdict;
    if (warranty === 'no') {
      verdict = 'NOT_QUALIFIED';
    } else if (anyMet && windowState === 'met' && warranty === 'yes') {
      verdict = 'STRONG';
    } else if (anyMet || nearMiss) {
      verdict = 'PROMISING';
    } else {
      verdict = 'NOT_QUALIFIED';
    }

    if (verdict === 'PROMISING' && anyMet && windowState === 'missed') {
      flags.push('A presumption criterion is met but the first repair falls outside the ' +
        cfg.presumptionWindow.months + '-month / ' + cfg.presumptionWindow.miles.toLocaleString() +
        '-mile window. The presumption may not apply, but the claim can still be viable — attorney judgment required.');
    }

    return {
      verdict: verdict,
      verdictLabel: verdict === 'STRONG' ? 'STRONG CANDIDATE'
        : verdict === 'PROMISING' ? 'PROMISING — NEEDS DOCUMENTATION'
        : 'LIKELY NOT QUALIFIED',
      criteria: criteria,
      window: {
        state: windowState,
        monthsToFirstRepair: d.monthsToFirstRepair,
        milesDeltaAtFirstRepair: d.milesDeltaAtFirstRepair,
        limitMonths: cfg.presumptionWindow.months,
        limitMiles: cfg.presumptionWindow.miles
      },
      computed: {
        attempts: d.attempts,
        daysOut: d.daysOut
      },
      flags: flags,
      audit: {
        timestamp: new Date().toISOString(),
        ruleVersion: cfg.version,
        inputsHash: inputsHash({ v: caseData.vehicle, w: caseData.warranty, p: caseData.problem, r: caseData.repairs })
      }
    };
  }

  global.LemonRules = {
    RULES_CONFIG: RULES_CONFIG,
    evaluateCase: evaluateCase,
    computeDerived: computeDerived,
    inputsHash: inputsHash
  };

})(typeof window !== 'undefined' ? window : globalThis);
