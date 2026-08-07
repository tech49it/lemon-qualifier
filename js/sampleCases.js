/* =========================================================================
 * sampleCases.js — three preloaded demo cases. ALL DATA IS FICTIONAL.
 * Names, phone numbers, VINs, dealers: invented for the demo.
 * VINs are deliberately not valid 17-char VINs — they are placeholders.
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
      repairs: [
        { dateIn: '2025-09-02', dateOut: '2025-09-12', mileage: '6480', shop: 'Westside Chevrolet (demo)', reported: 'Brakes grinding, pedal soft', done: 'Replaced master cylinder', resolved: false, samePrimaryDefect: true },
        { dateIn: '2025-11-20', dateOut: '2025-12-05', mileage: '9900', shop: 'Westside Chevrolet (demo)', reported: 'Pedal went to floor on freeway', done: 'Replaced brake booster, bled system', resolved: false, samePrimaryDefect: true },
        { dateIn: '2026-02-10', dateOut: '2026-02-19', mileage: '12300', shop: 'Valley Chevrolet Service (demo)', reported: 'Same intermittent pressure loss', done: 'ABS module replaced, software update', resolved: false, samePrimaryDefect: true }
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
      repairs: [
        { dateIn: '2025-06-10', dateOut: '2025-06-17', mileage: '7200', shop: 'Harbor Hyundai (demo)', reported: 'No-start, dead battery', done: 'Replaced battery', resolved: false, samePrimaryDefect: true },
        { dateIn: '2025-10-01', dateOut: '2025-10-10', mileage: '12900', shop: 'Harbor Hyundai (demo)', reported: 'No-start recurring, flickering dash', done: 'Parasitic draw test, replaced body control module', resolved: false, samePrimaryDefect: true },
        { dateIn: '2026-01-15', dateOut: '2026-01-20', mileage: '16750', shop: 'Harbor Hyundai (demo)', reported: 'Same drain issue', done: 'Wiring harness inspection, software update', resolved: false, samePrimaryDefect: true }
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
        { dateIn: '2026-03-03', dateOut: '2026-03-06', mileage: '86100', shop: 'Fairfax Motors service (demo)', reported: 'Oil leak, burning smell', done: 'Replaced valve cover gasket', resolved: false, samePrimaryDefect: true }
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
        { dateIn: '', dateOut: '', mileage: '', shop: '', reported: '', done: '', resolved: false, samePrimaryDefect: true }
      ]
    };
  }

  global.LemonSamples = { SAMPLE_CASES: SAMPLE_CASES, blankCase: blankCase };

})(typeof window !== 'undefined' ? window : globalThis);
