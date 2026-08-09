/* =========================================================================
 * sampleCases.js — three preloaded demo cases. ALL DATA IS FICTIONAL.
 * Names, phone numbers, VINs, dealers: invented for the demo.
 * VINs are deliberately not valid 17-char VINs — they are placeholders.
 *
 * v2.0.0: each repair visit now also carries the RO facsimile fields the
 * Stage 01 extraction reads — `ro` (repair-order number), `invoice` (invoice
 * date, which may deliberately conflict with dateOut), and `conf` (per-field
 * confidence 0-100). These are additive; the screening figures each case
 * produces (verdict, attempts, days out, exposure) are unchanged from v1.4.
 * The Rivera visit dates were adjusted so two visits at DIFFERENT dealers
 * overlap — the merged days-out total still equals 34, but the naive sum (39)
 * and the 5 de-duplicated days now render, exercising the OVERLAP flag.
 * ========================================================================= */

(function (global) {
  'use strict';

  var SAMPLE_CASES = [
    {
      id: 'case-strong',
      label: 'Rivera — brake failure',
      hint: 'Strong candidate',
      leadSource: 'google',
      language: 'en',
      contact: {
        name: 'Marisol Rivera',
        phone: '(555) 014-2231',
        email: 'm.rivera@example.com',
        city: 'Culver City, CA'
      },
      vehicle: {
        year: '2025', make: 'Chevrolet', model: 'Silverado 1500',
        condition: 'new', purchaseType: 'purchase',
        purchaseDate: '2025-04-14', purchasePrice: '58900', dealer: 'Westside Chevrolet (demo)',
        mileageAtPurchase: '12', currentMileage: '13850',
        vin: 'DEMO0000000000001'
      },
      warranty: {
        active: 'yes',
        type: 'Manufacturer new-vehicle (bumper-to-bumper)',
        expirationDate: '2028-04-14',
        warrantyIssuedAtSale: 'yes'
      },
      problem: {
        description: 'Intermittent loss of brake pressure. Pedal goes soft, twice to the floor at speed. Grinding noise preceded first failure.',
        safetyRelated: 'yes'
      },
      /* Three same-defect visits. V2 (RO 51044) carries an invoice/date-out
       * conflict; V3 (RO 52990) is at a second dealer, overlaps V2, and uses
       * "could not duplicate / no fault found" language. Merged days out = 34
       * (naive 39 − 5 overlapping). First-visit mileage 6,480 drives the offset. */
      repairs: [
        { ro: 'RO 48213', dateIn: '2025-09-02', dateOut: '2025-09-12', invoice: '2025-09-12', mileage: '6480', shop: 'Westside Chevrolet (demo)', reported: 'Brakes grinding, pedal soft', done: 'Replaced master cylinder', resolved: false, samePrimaryDefect: true, conf: { dates: 99, miles: 98, complaint: 96 } },
        { ro: 'RO 51044', dateIn: '2025-11-20', dateOut: '2025-12-05', invoice: '2025-12-03', mileage: '9900', shop: 'Westside Chevrolet (demo)', reported: 'Pedal went to floor on freeway', done: 'Replaced brake booster, bled system', resolved: false, samePrimaryDefect: true, conf: { dates: 97, miles: 99, complaint: 95 } },
        { ro: 'RO 52990', dateIn: '2025-11-30', dateOut: '2025-12-14', invoice: '2025-12-14', mileage: '10480', shop: 'Valley Chevrolet Service (demo)', reported: 'Same intermittent pressure loss; tech could not duplicate at this time', done: 'Road tested — no fault found this visit; ABS module flagged for follow-up', resolved: false, samePrimaryDefect: true, conf: { dates: 98, miles: 88, complaint: 97 } }
      ]
    },

    {
      id: 'case-borderline',
      label: 'Okafor — electrical drain',
      hint: 'Borderline',
      leadSource: 'meta',
      language: 'es',
      contact: {
        name: 'Daniel Okafor',
        phone: '(555) 019-8874',
        email: 'd.okafor@example.com',
        city: 'Inglewood, CA'
      },
      vehicle: {
        year: '2024', make: 'Hyundai', model: 'Tucson',
        condition: 'new', purchaseType: 'lease',
        purchaseDate: '2025-01-20', purchasePrice: '39500', dealer: 'Harbor Hyundai (demo)',
        mileageAtPurchase: '8', currentMileage: '17400',
        vin: 'DEMO0000000000002'
      },
      warranty: {
        active: 'unsure',
        type: 'Believed under factory warranty — booklet not provided',
        expirationDate: '2030-01-20',
        warrantyIssuedAtSale: 'yes'
      },
      problem: {
        description: 'Battery drains overnight; vehicle intermittently fails to start. Dash electronics flicker. Stranded twice.',
        safetyRelated: 'unsure'
      },
      /* Single-dealer history (no overlap). V2 (RO 21830) carries an
       * invoice/date-out conflict to exercise the DATE flag on extraction. */
      repairs: [
        { ro: 'RO 20441', dateIn: '2025-06-10', dateOut: '2025-06-17', invoice: '2025-06-17', mileage: '7200', shop: 'Harbor Hyundai (demo)', reported: 'No-start, dead battery', done: 'Replaced battery', resolved: false, samePrimaryDefect: true, conf: { dates: 99, miles: 97, complaint: 98 } },
        { ro: 'RO 21830', dateIn: '2025-10-01', dateOut: '2025-10-10', invoice: '2025-10-08', mileage: '12900', shop: 'Harbor Hyundai (demo)', reported: 'No-start recurring, flickering dash', done: 'Parasitic draw test, replaced body control module', resolved: false, samePrimaryDefect: true, conf: { dates: 96, miles: 99, complaint: 96 } },
        { ro: 'RO 22957', dateIn: '2026-01-15', dateOut: '2026-01-20', invoice: '2026-01-20', mileage: '16750', shop: 'Harbor Hyundai (demo)', reported: 'Same drain issue', done: 'Wiring harness inspection, software update', resolved: false, samePrimaryDefect: true, conf: { dates: 98, miles: 98, complaint: 97 } }
      ]
    },

    {
      id: 'case-notqualified',
      label: 'Petrosyan — used BMW oil leak',
      hint: 'Likely not qualified',
      leadSource: 'referral',
      language: 'en',
      contact: {
        name: 'Ani Petrosyan',
        phone: '(555) 010-4412',
        email: 'a.petrosyan@example.com',
        city: 'Glendale, CA'
      },
      vehicle: {
        year: '2016', make: 'BMW', model: '328i',
        condition: 'used', purchaseType: 'purchase',
        purchaseDate: '2026-01-05', purchasePrice: '18500', dealer: 'Fairfax Motors (independent, demo)',
        mileageAtPurchase: '84200', currentMileage: '87950',
        vin: 'DEMO0000000000003'
      },
      warranty: {
        active: 'no',
        type: 'Original factory warranty expired; sold as-is',
        expirationDate: '',
        warrantyIssuedAtSale: 'no'
      },
      problem: {
        description: 'Oil leak from valve cover area, burning smell after long drives.',
        safetyRelated: 'no'
      },
      repairs: [
        { ro: 'RO 77120', dateIn: '2026-03-03', dateOut: '2026-03-06', invoice: '2026-03-06', mileage: '86100', shop: 'Fairfax Motors service (demo)', reported: 'Oil leak, burning smell', done: 'Replaced valve cover gasket', resolved: false, samePrimaryDefect: true, conf: { dates: 97, miles: 95, complaint: 98 } }
      ]
    }
  ];

  /* Blank case template for "New case" */
  function blankCase() {
    return {
      id: 'case-new',
      label: 'New case',
      hint: '',
      leadSource: 'organic',
      language: 'en',
      contact: { name: '', phone: '', email: '', city: '' },
      vehicle: {
        year: '', make: '', model: '', condition: 'new', purchaseType: 'purchase',
        purchaseDate: '', purchasePrice: '', dealer: '', mileageAtPurchase: '', currentMileage: '',
        vin: ''
      },
      warranty: { active: 'unsure', type: '', expirationDate: '', warrantyIssuedAtSale: 'unsure' },
      problem: { description: '', safetyRelated: 'unsure' },
      repairs: [
        { ro: '', dateIn: '', dateOut: '', invoice: '', mileage: '', shop: '', reported: '', done: '', resolved: false, samePrimaryDefect: true, conf: { dates: 0, miles: 0, complaint: 0 } }
      ]
    };
  }

  global.LemonSamples = { SAMPLE_CASES: SAMPLE_CASES, blankCase: blankCase };

})(typeof window !== 'undefined' ? window : globalThis);
