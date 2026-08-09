/* =========================================================================
 * engine.js — Song-Beverly screening ENGINE (pure functions only)
 *
 * DEMO LOGIC ONLY. Every computation here enforces the attorney-owned
 * thresholds that live in js/rules.js (RULES_CONFIG). This file holds the
 * math and nothing else:
 *
 *   - zero DOM access, zero network, zero global state reads
 *   - every function takes its inputs (caseData, config, …) as parameters
 *   - same inputs -> same output, so it runs identically in Node for testing
 *
 * No UI code in this file. No legal advice in this file.
 *
 * Split out of the former js/rules.js in v2.0.0 so business logic and the
 * config the attorneys own live in separate files. rules.js is now data-only.
 * ========================================================================= */

(function (global) {
  'use strict';

  /* RULES_CONFIG default is read from the LemonRules namespace at call time
   * (rules.js loads first). Functions still accept an explicit config, so the
   * engine never depends on global state — the default is a convenience only. */
  function defaultConfig() {
    return (global.LemonRules && global.LemonRules.RULES_CONFIG) || null;
  }

  /* ----------------------------- helpers -------------------------------- */

  function parseDate(s) {
    if (!s) return null;
    var d = new Date(s + 'T00:00:00');
    return isNaN(d.getTime()) ? null : d;
  }

  var MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  /* ISO YYYY-MM-DD -> "Feb 11, 2025". Non-ISO input returned as-is. */
  function fmtHuman(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '').trim());
    if (!m) return String(iso || '');
    var mi = parseInt(m[2], 10) - 1;
    if (mi < 0 || mi > 11) return String(iso);
    return MONTH_ABBR[mi] + ' ' + parseInt(m[3], 10) + ', ' + m[1];
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

  function num(v) {
    if (v === '' || v === null || v === undefined) return null;
    var n = Number(v);
    return isNaN(n) ? null : n;
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

  /* ------------------- days out of service (range merge) -----------------
   * Merge overlapping out-of-service ranges so a day a vehicle sat at two
   * dealers is never counted twice. Returns the naive per-visit sum, the
   * overlap removed, and the merged total. Ported from v2's daysOutOfService
   * so the assessment's days-out figure is the de-duplicated total, not a
   * naive sum. Same-day ranges contribute 0 to the merged total (the min-1
   * per-visit convention is preserved separately in visitDays() for the
   * timeline strip). VERIFY COUNTING CONVENTIONS WITH COUNSEL.
   * --------------------------------------------------------------------- */
  function daysOutOfService(visits) {
    var ranges = (visits || [])
      .map(function (v) {
        var din = parseDate(v.dateIn), dout = parseDate(v.dateOut);
        return (din && dout && dout >= din) ? [din.getTime(), dout.getTime()] : null;
      })
      .filter(Boolean)
      .sort(function (a, b) { return a[0] - b[0]; });

    var merged = [], naive = 0;
    ranges.forEach(function (r) {
      var s = r[0], e = r[1];
      naive += Math.round((e - s) / 86400000);
      if (merged.length && s <= merged[merged.length - 1][1]) {
        merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], e);
      } else {
        merged.push([s, e]);
      }
    });
    var total = merged.reduce(function (t, r) {
      return t + Math.round((r[1] - r[0]) / 86400000);
    }, 0);
    return { total: total, naive: naive, overlap: naive - total };
  }

  /* ------------------- document extraction flags -------------------------
   * Surfaces anomalies a human must verify before the numbers are trusted:
   *   CND     — "could not duplicate / no fault found" language. The customer
   *             still reported the defect, so the visit counts as an attempt;
   *             dealership wording should not silently erase it.
   *   DATE    — invoice date disagrees with the recorded date-out.
   *   OVERLAP — out-of-service ranges overlapped across dealers and were
   *             de-duplicated.
   * Reads v1.4 repair fields (reported/done/shop) and the RO facsimile fields
   * added in v2.0.0 (ro/invoice). Pure — no DOM. VERIFY WITH COUNSEL.
   * --------------------------------------------------------------------- */
  function docFlags(caseData) {
    var flags = [];
    var visits = ((caseData && caseData.repairs) || [])
      .filter(function (r) { return r.samePrimaryDefect !== false; });

    visits.forEach(function (v, i) {
      var ro = v.ro || ('Visit ' + (i + 1));
      var text = String(v.reported || v.complaint || '') + ' ' + String(v.done || v.correction || '');
      if (/COULD NOT DUPLICATE|NO FAULT FOUND/i.test(text)) {
        flags.push({
          visit: i, code: 'CND',
          text: ro + ': “could not duplicate / no fault found” language — customer reported the defect, so counted as a repair attempt (verify with counsel).'
        });
      }
      if (v.invoice && v.dateOut && v.invoice !== v.dateOut) {
        flags.push({
          visit: i, code: 'DATE',
          text: ro + ': invoice date ' + fmtHuman(v.invoice) + ' conflicts with date out ' + fmtHuman(v.dateOut) +
            ' — days-out uses date in/out; conflict queued for verification.'
        });
      }
    });

    var dos = daysOutOfService(visits);
    if (dos.overlap > 0) {
      flags.push({
        visit: -1, code: 'OVERLAP',
        text: dos.overlap + ' overlapping out-of-service day' + (dos.overlap > 1 ? 's' : '') +
          ' across dealers de-duplicated (naive sum ' + dos.naive + ' → ' + dos.total + ').'
      });
    }
    return flags;
  }

  /* --------------------------- computations ------------------------------ */

  function computeDerived(caseData) {
    var rows = caseData.repairs || [];
    var relevant = rows.filter(function (r) { return r.samePrimaryDefect !== false; });

    var attempts = relevant.length;

    /* Days out of service via range-merge de-duplication (v2.0.0). The naive
     * per-visit sum and the overlap removed are kept for display. */
    var dos = daysOutOfService(relevant);
    var daysOut = dos.total;

    /* daysUnknown: a relevant visit is missing a parseable in/out date, so the
     * true total may be higher than what the range-merge could compute. */
    var daysUnknown = relevant.some(function (r) {
      return parseDate(r.dateIn) === null || parseDate(r.dateOut) === null;
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
      daysOutNaive: dos.naive,
      daysOutOverlap: dos.overlap,
      daysUnknown: daysUnknown,
      monthsToFirstRepair: monthsToFirst,
      milesDeltaAtFirstRepair: milesDelta
    };
  }

  /* ----------------------------- evaluator ------------------------------- */

  /**
   * evaluateCase(caseData, config) -> assessment
   * Pure function. No DOM, no network. Same inputs, same output.
   */
  function evaluateCase(caseData, config) {
    var cfg = config || defaultConfig();
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
        (d.daysOutOverlap > 0 ? ' ' + d.daysOutOverlap + ' overlapping day(s) removed (naive ' + d.daysOutNaive + ').' : '') +
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
        daysOut: d.daysOut,
        daysOutNaive: d.daysOutNaive,
        daysOutOverlap: d.daysOutOverlap
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
   * Pure lookup against the attorney-maintained opt-in roster in config. Makes
   * no legal determination. (v2's routeTrack(c, roster, hypoFast) is subsumed
   * by this richer v1.4 version — the roster ships empty and is populated in
   * the UI, which is the same "assume opted in" affordance, kept as data.)
   */
  function resolveTrack(caseData, config) {
    var cfg = config || defaultConfig();
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
        detail: 'No manufacturer opt-in registry has been configured. The firm’s attorneys maintain this list; once populated, every case routes automatically.'
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
    var cfg = config || defaultConfig();
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
          ? 'Traditional track — limitations analysis is an attorney determination, not computed here.'
          : 'Track undetermined — no deadline computed.'
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
        basis: 'Cannot compute — missing ' + missing.join(' and ') + '.'
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
      basis: ft.presuitNoticeDays + ' days. A duration, not a fixed date — runs from service of the notice.'
    });

    out.push({
      id: 'mediation',
      label: 'Mediation window',
      date: null,
      daysRemaining: null,
      severity: 'info',
      basis: ft.mediationWindowDays + ' days from the manufacturer’s answer. Duration, not a fixed date.'
    });

    return out;
  }

  /**
   * screenUsedVehicle(caseData, config) -> { flagged, severity, message }
   */
  function screenUsedVehicle(caseData, config) {
    var cfg = config || defaultConfig();
    var scr = cfg.usedVehicleScreening;

    if (!scr || !scr.enabled || caseData.vehicle.condition !== 'used') {
      return { flagged: false, severity: 'info', message: null };
    }

    var atSale = caseData.warranty.warrantyIssuedAtSale;

    if (atSale === 'no') {
      return {
        flagged: true,
        severity: 'critical',
        message: 'Used vehicle with no manufacturer warranty issued at sale. Rodriguez v. FCA US LLC (Cal. 2024) narrowed Song-Beverly coverage for used vehicles. Attorney review required before declining — other consumer-protection claims may still apply.'
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
   * Pure derivation for the repair-timeline strip. No DOM. Reads
   * computeDerived() for the totals line and derives bar/marker POSITIONS from
   * the raw visit dates. todayOverride is accepted for deterministic testing.
   */
  function buildTimeline(caseData, config, todayOverride) {
    var cfg = config || defaultConfig();
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
   * configured rules — never a valuation, never a decision. `assessment` is
   * the object returned by evaluateCase() for the same caseData/config, so
   * verdict logic is never duplicated here.
   * --------------------------------------------------------------------- */
  function estimateValue(caseData, assessment, config) {
    var cfg = config || defaultConfig();
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
      offsetBasis = 'Offset = price × (' + offsetMiles.toLocaleString() + ' mi at first repair ÷ ' +
        vs.mileageOffsetDenominator.toLocaleString() + ') per configured denominator — demo convention, verify with counsel.';
    } else if (price === null) {
      offsetBasis = 'Purchase price not provided — exposure cannot be computed. Request the purchase contract.';
      reasoning.push('Exposure unknown: purchase price missing from intake.');
    } else {
      offsetBasis = 'First-repair mileage or purchase mileage missing — offset cannot be computed.';
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
      ? 'Fee-shifting posture uncertain — warranty gate unresolved. Attorney determination required.'
      : 'Song-Beverly fee-shifting generally applies to a prevailing buyer — demo note, verify with counsel.';

    /* --- tier: derived from configured rules; basis stated per line --- */
    var tier, tierLabel;
    if (assessment.verdict === 'NOT_QUALIFIED') {
      tier = 'LIKELY_DECLINE'; tierLabel = 'LIKELY DECLINE';
      reasoning.push('Screening verdict is LIKELY NOT QUALIFIED — value tier follows the qualification screen.');
    } else if (assessment.verdict === 'STRONG' && exposure !== null && exposure >= (vs.exposureReviewFloor || 0)) {
      tier = 'FULL_BUYBACK_CANDIDATE'; tierLabel = 'FULL BUYBACK CANDIDATE';
      reasoning.push('STRONG screening verdict and estimated exposure $' + exposure.toLocaleString() +
        ' meets the configured review floor ($' + (vs.exposureReviewFloor || 0).toLocaleString() + ').');
    } else {
      tier = 'ATTORNEY_REVIEW'; tierLabel = 'ATTORNEY REVIEW';
      if (assessment.verdict === 'STRONG' && exposure === null) {
        reasoning.push('STRONG screening verdict, but exposure could not be computed — tier held at review until price/mileage documented.');
      } else if (assessment.verdict === 'STRONG') {
        reasoning.push('STRONG screening verdict, but estimated exposure $' + exposure.toLocaleString() +
          ' is below the configured review floor ($' + (vs.exposureReviewFloor || 0).toLocaleString() + ') — attorney decides whether the case size fits the docket.');
      } else {
        reasoning.push('Screening verdict is ' + assessment.verdictLabel + ' — attorney review before prioritization.');
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

  /* Merge the engine onto the LemonRules namespace (rules.js contributes
   * RULES_CONFIG to the same object). app.js keeps calling LemonRules.* — the
   * split is internal. */
  var NS = global.LemonRules = global.LemonRules || {};
  NS.evaluateCase = evaluateCase;
  NS.estimateValue = estimateValue;
  NS.computeDerived = computeDerived;
  NS.inputsHash = inputsHash;
  NS.resolveTrack = resolveTrack;
  NS.computeDeadlines = computeDeadlines;
  NS.screenUsedVehicle = screenUsedVehicle;
  NS.buildTimeline = buildTimeline;
  NS.daysOutOfService = daysOutOfService;
  NS.docFlags = docFlags;
  NS.fmtHuman = fmtHuman;

})(typeof window !== 'undefined' ? window : globalThis);
