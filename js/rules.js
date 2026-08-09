/* =========================================================================
 * rules.js — Song-Beverly presumption rules: CONFIG (data only)
 *
 * DEMO LOGIC ONLY. Every threshold below is illustrative and must be
 * validated by the firm's attorneys before any real-world use. The point
 * of this file is architectural: the rules live in one visible, editable
 * config object that the firm owns. The engine (js/engine.js) enforces
 * whatever the attorneys decide — it does not decide for them.
 *
 * As of v2.0.0 this file is DATA ONLY — the pure screening functions moved
 * to js/engine.js so business logic and the attorney-owned config live in
 * separate files. No functions here. No UI code. No legal advice.
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
    version: '2.0.0-demo',
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

    /* Day-counting convention: (date out − date in), same-day visit = 1 on the
     * timeline; cumulative days use range-merge de-duplication (see engine.js
     * daysOutOfService). Counting convention itself must be VERIFIED WITH COUNSEL. */
    dayCounting: 'out-minus-in, overlaps merged so no day counts twice',

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

  /* Data only — attach the config to the shared LemonRules namespace. The
   * engine (js/engine.js) attaches the functions to the same object. */
  var NS = global.LemonRules = global.LemonRules || {};
  NS.RULES_CONFIG = RULES_CONFIG;

})(typeof window !== 'undefined' ? window : globalThis);
