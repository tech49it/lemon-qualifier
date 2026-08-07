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
   * Referenced guideline: California Civil Code § 1793.22 ("Tanner
   * Consumer Protection Act" presumption). Cited here as the demo's
   * starting point only — VERIFY CURRENT STATUTE WITH COUNSEL.
   * --------------------------------------------------------------------- */
  var RULES_CONFIG = {
    version: '1.4.0-demo',
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
    dayCounting: 'out-minus-in, minimum 1 per visit',

    /* -------------------------------------------------------------------
     * PROCEDURAL TRACK — AB 1755 / SB 26 opt-in framework
     *
     * ALL VALUES ARE DEMO ONLY. VERIFY WITH COUNSEL.
     *
     * AB 1755 (signed Sept 2024) and cleanup bill SB 26 created an
     * opt-in framework: manufacturers may elect into fast-track
     * procedures. Public sources disagreed on the operative date for the
     * pre-suit notice rules (April 1 vs July 1, 2025). That disagreement
     * is exactly why these are configuration, not assertions.
     * ----------------------------------------------------------------- */
    proceduralTracks: {
      enabled: true,
      fastTrack: {
        label: 'Fast track (manufacturer opted in)',
        presuitNoticeDays: 30,           // VERIFY WITH COUNSEL
        mediationWindowDays: 150,        // VERIFY WITH COUNSEL — from answer
        solYearsAfterWarrantyExpiry: 1,  // VERIFY WITH COUNSEL
        solCapYearsFromDelivery: 6       // VERIFY WITH COUNSEL
      },
      traditionalTrack: {
        label: 'Traditional Song-Beverly track',
        note: 'Manufacturer did not opt in. Pre-suit notice and mediation timing follow prior practice. Attorney determines applicable deadlines.'
      },
      warnDaysBeforeSol: 120
    },

    /* Attorney-maintained. Keys are lowercase, trimmed manufacturer names.
     * SHIPS EMPTY BY DESIGN — the firm populates this. We do not have a
     * verified opt-in roster and will not guess at one. */
    manufacturerRegistry: {
      // 'example motors': { optedIn: true, effectiveFrom: '2025-01-01', note: '' }
    },

    /* Post-Rodriguez used-vehicle screening. VERIFY WITH COUNSEL.
     * Rodriguez v. FCA US LLC (Cal. 2024) narrowed Song-Beverly coverage
     * for used vehicles. CPO sold with a manufacturer-issued warranty at
     * time of sale may still qualify. Attorney determination required. */
    usedVehicleScreening: {
      enabled: true,
      requireManufacturerWarrantyAtSale: true
    },

    /* -------------------------------------------------------------------
     * VALUE SCREEN — case value & priority (screening arithmetic only)
     *
     * ALL VALUES ARE DEMO ONLY. VERIFY WITH COUNSEL.
     *
     * Purpose: help intake surface likely full-repurchase candidates so
     * attorney hours go where recovery justifies them. This is triage
     * arithmetic from configured rules — it is not a valuation, not a
     * settlement prediction, and never a decision. Attorney review is
     * required on every tier.
     * ----------------------------------------------------------------- */
    valueScreen: {
      enabled: true,
      /* Statutory mileage-offset convention: price × (miles at first
       * repair attempt for the defect ÷ denominator). Civ. Code
       * § 1793.2(d)(2)(C) uses 120,000 — cited as the demo's starting
       * point only. VERIFY WITH COUNSEL. */
      mileageOffsetDenominator: 120000,
      /* Estimated net repurchase exposure below this promotes the tier
       * to ATTORNEY REVIEW instead of FULL BUYBACK CANDIDATE. Pure
       * screening heuristic — the firm sets where "small case" begins.
       * VERIFY WITH COUNSEL. */
      exposureReviewFloor: 15000,
      /* Civil-penalty posture: factors are surfaced as present/absent
       * for attorney assessment. The screen never estimates a penalty
       * amount — willfulness is a legal determination. */
      civilPenaltyFactorLabels: {
        attemptsBeyondThreshold: 'Repair attempts continued beyond the configured presumption threshold',
        safetyDefectUnresolved: 'Safety-related defect reported and still unresolved after final recorded visit',
        extendedDaysOut: 'Days out of service exceed the configured threshold',
        multipleShops: 'Defect presented at more than one authorized repair facility',
        windowMet: 'First repair fell inside the configured presumption window'
      }
    }
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

  /* ----------------------- procedural track ------------------------------ */

  function addYears(date, years) {
    if (!date) return null;
    var d = new Date(date.getTime());
    d.setFullYear(d.getFullYear() + years);
    return d;
  }

  function daysBetween(from, to) {
    if (!from || !to) return null;
    return Math.round((to - from) / 86400000);
  }

  function fmtDate(d) {
    if (!d) return null;
    return d.toISOString().slice(0, 10);
  }

  /**
   * resolveTrack(caseData, config) -> { status, label, manufacturerKey, detail }
   * status: 'fast_track' | 'traditional' | 'unknown'
   * Pure lookup. Makes no legal determination.
   */
  function resolveTrack(caseData, config) {
    var cfg = config || RULES_CONFIG;
    var registry = cfg.manufacturerRegistry || {};
    var raw = (caseData.vehicle && caseData.vehicle.make) || '';
    var key = String(raw).trim().toLowerCase();
    var registryEmpty = Object.keys(registry).length === 0;

    if (!key) {
      return {
        status: 'unknown',
        label: 'Track undetermined',
        manufacturerKey: null,
        detail: 'No manufacturer entered. Track cannot be resolved.'
      };
    }

    if (registryEmpty) {
      return {
        status: 'unknown',
        label: 'Track undetermined',
        manufacturerKey: key,
        detail: 'No manufacturer opt-in registry has been configured. The firm\u2019s attorneys maintain this list; once populated, every case routes automatically.'
      };
    }

    var entry = registry[key];
    if (!entry) {
      return {
        status: 'unknown',
        label: 'Track undetermined',
        manufacturerKey: key,
        detail: 'No registry entry for "' + raw + '". Attorney must confirm whether this manufacturer elected into the fast-track procedures.'
      };
    }

    if (entry.optedIn) {
      return {
        status: 'fast_track',
        label: cfg.proceduralTracks.fastTrack.label,
        manufacturerKey: key,
        detail: 'Registry lists this manufacturer as opted in' +
          (entry.effectiveFrom ? ' (effective ' + entry.effectiveFrom + ')' : '') + '.'
      };
    }

    return {
      status: 'traditional',
      label: cfg.proceduralTracks.traditionalTrack.label,
      manufacturerKey: key,
      detail: cfg.proceduralTracks.traditionalTrack.note
    };
  }

  /**
   * computeDeadlines(caseData, track, config) -> [{ id, label, date, daysRemaining, severity, basis }]
   * Calendar arithmetic on attorney-configured intervals. Not a limitations opinion.
   */
  function computeDeadlines(caseData, track, config) {
    var cfg = config || RULES_CONFIG;
    var ft = cfg.proceduralTracks.fastTrack;
    var out = [];
    var today = new Date();

    if (!track || track.status !== 'fast_track') {
      out.push({
        id: 'sol',
        label: 'Statute of limitations',
        date: null,
        daysRemaining: null,
        severity: 'info',
        basis: track && track.status === 'traditional'
          ? 'Traditional track \u2014 limitations analysis is an attorney determination, not computed here.'
          : 'Track undetermined \u2014 no deadline computed.'
      });
      return out;
    }

    var delivery = parseDate(caseData.vehicle.purchaseDate);
    var warrantyEnd = parseDate(caseData.warranty.expirationDate);

    if (!warrantyEnd || !delivery) {
      var missing = [];
      if (!delivery) missing.push('delivery date');
      if (!warrantyEnd) missing.push('warranty expiration date');
      out.push({
        id: 'sol',
        label: 'Statute of limitations',
        date: null,
        daysRemaining: null,
        severity: 'warning',
        basis: 'Cannot compute \u2014 missing ' + missing.join(' and ') + '.'
      });
    } else {
      var candA = addYears(warrantyEnd, ft.solYearsAfterWarrantyExpiry);
      var candB = addYears(delivery, ft.solCapYearsFromDelivery);
      var eff = candA <= candB ? candA : candB;
      var yrs = ft.solYearsAfterWarrantyExpiry;
      var controlled = candA <= candB
        ? yrs + (yrs === 1 ? ' year' : ' years') + ' after warranty expiry'
        : ft.solCapYearsFromDelivery + '-year cap from delivery';
      var rem = daysBetween(today, eff);
      out.push({
        id: 'sol',
        label: 'Statute of limitations (earlier of two rules)',
        date: fmtDate(eff),
        daysRemaining: rem,
        severity: rem < 0 ? 'critical' : (rem <= cfg.proceduralTracks.warnDaysBeforeSol ? 'warning' : 'info'),
        basis: 'Controlled by ' + controlled + '. Other candidate: ' +
          fmtDate(candA <= candB ? candB : candA) + '.'
      });
    }

    out.push({
      id: 'presuit',
      label: 'Pre-suit notice period',
      date: null,
      daysRemaining: null,
      severity: 'info',
      basis: ft.presuitNoticeDays + ' days. A duration, not a fixed date \u2014 runs from service of the notice.'
    });

    out.push({
      id: 'mediation',
      label: 'Mediation window',
      date: null,
      daysRemaining: null,
      severity: 'info',
      basis: ft.mediationWindowDays + ' days from the manufacturer\u2019s answer. Duration, not a fixed date.'
    });

    return out;
  }

  /**
   * screenUsedVehicle(caseData, config) -> { flagged, severity, message }
   */
  function screenUsedVehicle(caseData, config) {
    var cfg = config || RULES_CONFIG;
    var scr = cfg.usedVehicleScreening;

    if (!scr || !scr.enabled || caseData.vehicle.condition !== 'used') {
      return { flagged: false, severity: 'info', message: null };
    }

    var atSale = caseData.warranty.warrantyIssuedAtSale;

    if (atSale === 'no') {
      return {
        flagged: true,
        severity: 'critical',
        message: 'Used vehicle with no manufacturer warranty issued at sale. Rodriguez v. FCA US LLC (Cal. 2024) narrowed Song-Beverly coverage for used vehicles. Attorney review required before declining \u2014 other consumer-protection claims may still apply.'
      };
    }

    if (atSale === 'unsure') {
      return {
        flagged: true,
        severity: 'warning',
        message: 'Used vehicle, warranty-at-sale status unconfirmed. Request the sales contract and warranty documentation before attorney review. Post-Rodriguez, this is the controlling question for coverage.'
      };
    }

    return {
      flagged: false,
      severity: 'info',
      message: 'Used vehicle reported as sold with a manufacturer warranty. Whether it qualifies as CPO under Rodriguez is an attorney determination.'
    };
  }

  /* --------------------------- repair timeline --------------------------- */

  /**
   * buildTimeline(caseData, config, todayOverride) -> timeline data
   * Pure derivation for the repair-timeline strip. No DOM. Does NOT recompute
   * attempts/days — it reads computeDerived() for the totals line and only
   * derives bar/marker POSITIONS from the raw visit dates. Fractions are along
   * an axis from delivery (or earliest visit) to the later of today or the last
   * visit-out date. Rendering (app.js) turns fractions into CSS percentages.
   *
   * todayOverride is accepted for deterministic testing; defaults to new Date().
   */
  function buildTimeline(caseData, config, todayOverride) {
    var cfg = config || RULES_CONFIG;
    var rows = (caseData && caseData.repairs) || [];
    var derived = computeDerived(caseData); // totals only — not recomputed here

    var delivery = parseDate(caseData && caseData.vehicle && caseData.vehicle.purchaseDate);
    var today = todayOverride
      ? (todayOverride instanceof Date ? todayOverride : parseDate(todayOverride))
      : new Date();

    var visits = rows.map(function (r, i) {
      var din = parseDate(r.dateIn);
      var dout = parseDate(r.dateOut);
      return {
        index: i,
        din: din, dout: dout,
        dateIn: r.dateIn || '', dateOut: r.dateOut || '',
        shop: r.shop || '', reported: r.reported || '',
        samePrimaryDefect: r.samePrimaryDefect !== false,
        days: visitDays(r),          // null when a date is missing
        complete: !!(din && dout)
      };
    });

    /* Axis start: delivery if known, else earliest visit dateIn */
    var startCands = [];
    if (delivery) startCands.push(delivery.getTime());
    visits.forEach(function (v) { if (v.din) startCands.push(v.din.getTime()); });
    var axisStartMs = startCands.length ? Math.min.apply(null, startCands) : null;

    /* Axis end: later of today or the last visit-out (also consider dateIn for markers) */
    var endCands = [];
    if (today) endCands.push(today.getTime());
    visits.forEach(function (v) {
      if (v.dout) endCands.push(v.dout.getTime());
      if (v.din) endCands.push(v.din.getTime());
    });
    var axisEndMs = endCands.length ? Math.max.apply(null, endCands) : null;

    var hasAxis = axisStartMs !== null && axisEndMs !== null && axisEndMs > axisStartMs;
    var span = hasAxis ? (axisEndMs - axisStartMs) : 0;

    function frac(ms) {
      if (!hasAxis || ms === null || ms === undefined) return 0;
      var f = (ms - axisStartMs) / span;
      return f < 0 ? 0 : (f > 1 ? 1 : f);
    }

    var segments = visits.map(function (v) {
      if (v.complete) {
        var startF = frac(v.din.getTime());
        var endF = frac(v.dout.getTime());
        var widthF = endF - startF;
        if (widthF < 0) widthF = 0;
        return {
          kind: 'bar', index: v.index,
          startFrac: startF, widthFrac: widthF,
          dateIn: v.dateIn, dateOut: v.dateOut, days: v.days,
          shop: v.shop, reported: v.reported,
          samePrimaryDefect: v.samePrimaryDefect, incomplete: false
        };
      }
      var anchor = v.din || v.dout || null;
      return {
        kind: 'marker', index: v.index,
        startFrac: anchor ? frac(anchor.getTime()) : 0, widthFrac: 0,
        dateIn: v.dateIn, dateOut: v.dateOut, days: null,
        shop: v.shop, reported: v.reported,
        samePrimaryDefect: v.samePrimaryDefect, incomplete: true,
        anchored: !!anchor
      };
    });

    /* Presumption window boundary = delivery + presumptionWindow.months */
    var presumption = null;
    if (delivery && cfg.presumptionWindow && cfg.presumptionWindow.months != null) {
      var boundary = new Date(delivery.getTime());
      boundary.setMonth(boundary.getMonth() + cfg.presumptionWindow.months);
      var bMs = boundary.getTime();
      presumption = {
        boundaryISO: fmtDate(boundary),
        months: cfg.presumptionWindow.months,
        frac: frac(bMs),
        closed: today ? bMs < today.getTime() : false,
        inRange: hasAxis && bMs >= axisStartMs && bMs <= axisEndMs
      };
    }

    return {
      hasVisits: visits.length > 0,
      hasAxis: hasAxis,
      deliveryISO: delivery ? fmtDate(delivery) : null,
      axis: {
        startISO: axisStartMs !== null ? fmtDate(new Date(axisStartMs)) : null,
        endISO: axisEndMs !== null ? fmtDate(new Date(axisEndMs)) : null,
        spanDays: hasAxis ? Math.round(span / 86400000) : 0
      },
      segments: segments,
      presumption: presumption,
      totals: {
        attempts: derived.attempts,
        daysOut: derived.daysOut,
        daysUnknown: derived.daysUnknown
      }
    };
  }

  /* ----------------------- value screen ---------------------------------
   * estimateValue(caseData, assessment, config) -> valueScreen
   * Pure function. No DOM, no network. Screening arithmetic from the
   * configured rules — never a valuation, never a decision.
   * `assessment` is the object returned by evaluateCase() for the same
   * caseData/config, so verdict logic is never duplicated here.
   * --------------------------------------------------------------------- */
  function estimateValue(caseData, assessment, config) {
    var cfg = config || RULES_CONFIG;
    var vs = cfg.valueScreen || {};
    var d = computeDerived(caseData);
    var reasoning = [];

    /* --- repurchase exposure: price − statutory-style mileage offset --- */
    var price = num(caseData.vehicle.purchasePrice);
    var milesAtPurchase = num(caseData.vehicle.mileageAtPurchase);
    var relevant = (caseData.repairs || []).filter(function (r) { return r.samePrimaryDefect; });
    var first = relevant.slice().sort(function (a, b) {
      return (parseDate(a.dateIn) || Infinity) - (parseDate(b.dateIn) || Infinity);
    })[0] || null;
    var milesAtFirst = first ? num(first.mileage) : null;
    var offsetMiles = (milesAtPurchase !== null && milesAtFirst !== null)
      ? Math.max(0, milesAtFirst - milesAtPurchase) : null;

    var exposure = null, offsetAmount = null, offsetBasis;
    if (price !== null && offsetMiles !== null && vs.mileageOffsetDenominator) {
      offsetAmount = Math.round(price * (offsetMiles / vs.mileageOffsetDenominator));
      exposure = Math.max(0, price - offsetAmount);
      offsetBasis = 'Offset = price \u00d7 (' + offsetMiles.toLocaleString() + ' mi at first repair \u00f7 ' +
        vs.mileageOffsetDenominator.toLocaleString() + ') per configured denominator \u2014 demo convention, verify with counsel.';
    } else if (price === null) {
      offsetBasis = 'Purchase price not provided \u2014 exposure cannot be computed. Request the purchase contract.';
      reasoning.push('Exposure unknown: purchase price missing from intake.');
    } else {
      offsetBasis = 'First-repair mileage or purchase mileage missing \u2014 offset cannot be computed.';
      reasoning.push('Exposure unknown: mileage figures incomplete.');
    }

    /* --- civil-penalty posture: factors surfaced, never an amount --- */
    var labels = vs.civilPenaltyFactorLabels || {};
    var shops = {};
    relevant.forEach(function (r) { if (r.shop) shops[r.shop.toLowerCase().trim()] = true; });
    var lastVisit = relevant[relevant.length - 1] || null;
    var factors = [
      { id: 'attemptsBeyondThreshold', present: d.attempts > cfg.criteria.sameDefectAttempts.threshold },
      { id: 'safetyDefectUnresolved', present: caseData.problem.safetyRelated === 'yes' && !!lastVisit && lastVisit.resolved === false,
        unknown: caseData.problem.safetyRelated === 'unsure' },
      { id: 'extendedDaysOut', present: d.daysOut > cfg.criteria.daysOutOfService.threshold },
      { id: 'multipleShops', present: Object.keys(shops).length > 1 },
      { id: 'windowMet', present: assessment.window.state === 'met', unknown: assessment.window.state === 'unknown' }
    ].map(function (f) {
      return { id: f.id, label: labels[f.id] || f.id,
        state: f.unknown ? 'unknown' : (f.present ? 'present' : 'absent') };
    });
    var presentCount = factors.filter(function (f) { return f.state === 'present'; }).length;

    /* --- fee posture: statute-based note, attorney confirms --- */
    var feePosture = (caseData.warranty.active === 'no')
      ? 'Fee-shifting posture uncertain \u2014 warranty gate unresolved. Attorney determination required.'
      : 'Song-Beverly fee-shifting generally applies to a prevailing buyer \u2014 demo note, verify with counsel.';

    /* --- tier: derived from configured rules; basis stated per line --- */
    var tier, tierLabel;
    if (assessment.verdict === 'NOT_QUALIFIED') {
      tier = 'LIKELY_DECLINE'; tierLabel = 'LIKELY DECLINE';
      reasoning.push('Screening verdict is LIKELY NOT QUALIFIED \u2014 value tier follows the qualification screen.');
    } else if (assessment.verdict === 'STRONG' && exposure !== null && exposure >= (vs.exposureReviewFloor || 0)) {
      tier = 'FULL_BUYBACK_CANDIDATE'; tierLabel = 'FULL BUYBACK CANDIDATE';
      reasoning.push('STRONG screening verdict and estimated exposure $' + exposure.toLocaleString() +
        ' meets the configured review floor ($' + (vs.exposureReviewFloor || 0).toLocaleString() + ').');
    } else {
      tier = 'ATTORNEY_REVIEW'; tierLabel = 'ATTORNEY REVIEW';
      if (assessment.verdict === 'STRONG' && exposure === null) {
        reasoning.push('STRONG screening verdict, but exposure could not be computed \u2014 tier held at review until price/mileage documented.');
      } else if (assessment.verdict === 'STRONG') {
        reasoning.push('STRONG screening verdict, but estimated exposure $' + exposure.toLocaleString() +
          ' is below the configured review floor ($' + (vs.exposureReviewFloor || 0).toLocaleString() + ') \u2014 attorney decides whether the case size fits the docket.');
      } else {
        reasoning.push('Screening verdict is ' + assessment.verdictLabel + ' \u2014 attorney review before prioritization.');
      }
    }

    return {
      tier: tier,
      tierLabel: tierLabel,
      reasoning: reasoning,
      exposure: {
        price: price,
        offsetMiles: offsetMiles,
        offsetAmount: offsetAmount,
        net: exposure,
        basis: offsetBasis,
        denominator: vs.mileageOffsetDenominator || null
      },
      civilPenalty: {
        factors: factors,
        presentCount: presentCount,
        total: factors.length,
        note: 'Willfulness is a legal determination. The screen surfaces factors for attorney assessment and never estimates a penalty amount.'
      },
      feePosture: feePosture,
      audit: assessment.audit
    };
  }

  global.LemonRules = {
    RULES_CONFIG: RULES_CONFIG,
    evaluateCase: evaluateCase,
    estimateValue: estimateValue,
    computeDerived: computeDerived,
    inputsHash: inputsHash,
    resolveTrack: resolveTrack,
    computeDeadlines: computeDeadlines,
    screenUsedVehicle: screenUsedVehicle,
    buildTimeline: buildTimeline
  };

})(typeof window !== 'undefined' ? window : globalThis);
