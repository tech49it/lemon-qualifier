/* =========================================================================
 * closedCases.js — FICTIONAL closed-case history + comparables matcher.
 *
 * ALL DATA IS FICTIONAL. Every case, vehicle, amount, and outcome below is
 * invented for the demo. In production this module is replaced by a query
 * against the firm's own resolved matters in its case-management system —
 * that is the entire point: the firm's closed cases already contain the
 * pattern of which intakes were worth taking. Nobody has to guess.
 *
 * Matching is deterministic, weighted field similarity — no ML, no network.
 * Pure functions only; runs identically in Node for testing.
 * ========================================================================= */

(function (global) {
  'use strict';

  /* Fictional resolved matters. Deliberately small and obviously demo-shaped. */
  var CLOSED_CASES = [
    { id: 'cc-01', label: 'Closed 2024 — pickup, brakes',       vehicleClass: 'truck',  make: 'chevrolet', condition: 'new',  safety: true,  attempts: 3, daysOut: 34, resolution: 'Repurchase',      outcome: 'Full repurchase; fees recovered', months: 7 },
    { id: 'cc-02', label: 'Closed 2025 — pickup, transmission', vehicleClass: 'truck',  make: 'ford',      condition: 'new',  safety: false, attempts: 5, daysOut: 41, resolution: 'Repurchase',      outcome: 'Full repurchase; fees recovered', months: 9 },
    { id: 'cc-03', label: 'Closed 2024 — SUV, electrical',      vehicleClass: 'suv',    make: 'hyundai',   condition: 'new',  safety: false, attempts: 4, daysOut: 22, resolution: 'Cash settlement', outcome: 'Cash-and-keep settlement',        months: 6 },
    { id: 'cc-04', label: 'Closed 2025 — SUV, stalling',        vehicleClass: 'suv',    make: 'kia',       condition: 'new',  safety: true,  attempts: 2, daysOut: 19, resolution: 'Repurchase',      outcome: 'Full repurchase; fees recovered', months: 8 },
    { id: 'cc-05', label: 'Closed 2023 — sedan, infotainment',  vehicleClass: 'sedan',  make: 'toyota',    condition: 'new',  safety: false, attempts: 3, daysOut: 9,  resolution: 'Declined',        outcome: 'Declined after attorney review',  months: 1 },
    { id: 'cc-06', label: 'Closed 2024 — used sedan, engine',   vehicleClass: 'sedan',  make: 'bmw',       condition: 'used', safety: false, attempts: 2, daysOut: 12, resolution: 'Declined',        outcome: 'Declined \u2014 warranty gate',   months: 1 },
    { id: 'cc-07', label: 'Closed 2025 — pickup, steering',     vehicleClass: 'truck',  make: 'ram',       condition: 'new',  safety: true,  attempts: 2, daysOut: 28, resolution: 'Repurchase',      outcome: 'Full repurchase; fees recovered', months: 10 },
    { id: 'cc-08', label: 'Closed 2024 — EV, battery drain',    vehicleClass: 'suv',    make: 'tesla',     condition: 'new',  safety: false, attempts: 3, daysOut: 26, resolution: 'Cash settlement', outcome: 'Cash-and-keep settlement',        months: 5 }
  ];

  /* Crude class inference from model text — demo heuristic only. */
  function inferClass(model) {
    var m = (model || '').toLowerCase();
    if (/silverado|f-150|f150|ram|tundra|tacoma|sierra|ranger|colorado/.test(m)) return 'truck';
    if (/tucson|rav4|cr-v|crv|highlander|explorer|tahoe|model y|model x|sorento|telluride/.test(m)) return 'suv';
    return 'sedan';
  }

  function band(n, edges) {
    for (var i = 0; i < edges.length; i++) { if (n <= edges[i]) return i; }
    return edges.length;
  }

  /**
   * findComparables(caseData, derived, opts) -> { matches, note }
   * derived = LemonRules.computeDerived(caseData)
   * Weighted similarity on structured fields; top 3, scored 0-100.
   * Deterministic. Fictional data. Context only — never a predicted result.
   */
  function findComparables(caseData, derived, opts) {
    var o = opts || {};
    var limit = o.limit || 3;
    var safety = caseData.problem.safetyRelated === 'yes';
    var cls = inferClass(caseData.vehicle.model);
    var make = (caseData.vehicle.make || '').toLowerCase().trim();
    var cond = caseData.vehicle.condition;
    var aBand = band(derived.attempts, [1, 2, 3, 4]);
    var dBand = band(derived.daysOut, [10, 20, 30, 45]);

    var scored = CLOSED_CASES.map(function (cc) {
      var score = 0;
      var why = [];
      if (cc.condition === cond) { score += 15; }
      if (cc.vehicleClass === cls) { score += 20; why.push('same vehicle class'); }
      if (cc.make === make) { score += 10; why.push('same make'); }
      if (cc.safety === safety) { score += 20; if (safety) why.push('safety-related defect'); }
      var aDiff = Math.abs(band(cc.attempts, [1, 2, 3, 4]) - aBand);
      score += Math.max(0, 20 - aDiff * 10);
      if (aDiff === 0) why.push('similar attempt count (' + cc.attempts + ')');
      var dDiff = Math.abs(band(cc.daysOut, [10, 20, 30, 45]) - dBand);
      score += Math.max(0, 15 - dDiff * 7);
      if (dDiff === 0) why.push('similar days out (' + cc.daysOut + ')');
      return { cc: cc, score: Math.min(100, score), why: why };
    });

    scored.sort(function (a, b) { return b.score - a.score || a.cc.id.localeCompare(b.cc.id); });
    var top = scored.slice(0, limit).map(function (s) {
      return {
        label: s.cc.label,
        matchPct: s.score,
        matchWhy: s.why.length ? s.why.join(', ') : 'partial profile overlap',
        resolution: s.cc.resolution,
        outcome: s.cc.outcome,
        monthsToResolve: s.cc.months
      };
    });

    var repurchases = top.filter(function (t) { return t.resolution === 'Repurchase'; }).length;

    return {
      matches: top,
      summary: repurchases + ' of ' + top.length + ' closest profile matches resolved as full repurchase (fictional sample).',
      note: 'Fictional closed-case sample for demonstration. Production draws on the firm\u2019s own resolved matters in its case-management system. Comparable outcomes are context for attorney judgment \u2014 never a predicted or promised result.'
    };
  }

  global.LemonClosed = { CLOSED_CASES: CLOSED_CASES, findComparables: findComparables };

})(typeof window !== 'undefined' ? window : globalThis);
