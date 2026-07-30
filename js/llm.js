/* =========================================================================
 * llm.js — Attorney Intake Summary generator.
 *
 * Two modes:
 *   mock (default) — deterministic template built from the structured case
 *     data. The demo runs fully offline. Regenerate cycles phrasing sets.
 *   live — calls the OpenAI API from the browser. FOR LOCAL DEMO ONLY:
 *     never ship an API key client-side. In production this call belongs
 *     behind a server the firm controls.
 *
 * Either way, the output is a DRAFT. It lands in an editable field and
 * does not count until a human marks it reviewed. That is the point.
 * ========================================================================= */

(function (global) {
  'use strict';

  var mockVariant = 0;

  function fmtMiles(n) {
    var v = Number(n);
    return isNaN(v) ? '—' : v.toLocaleString();
  }

  function buildMockSummary(caseData, assessment) {
    mockVariant = (mockVariant + 1) % 2;
    var v = caseData.vehicle;
    var veh = [v.year, v.make, v.model].filter(Boolean).join(' ') || 'Vehicle (unspecified)';
    var attempts = assessment.computed.attempts;
    var days = assessment.computed.daysOut;
    var w = assessment.window;

    var windowLine;
    if (w.state === 'met') {
      windowLine = 'First repair at ~' + w.monthsToFirstRepair + ' months / ' + fmtMiles(w.milesDeltaAtFirstRepair) +
        ' miles from delivery — inside the ' + w.limitMonths + '-month / ' + fmtMiles(w.limitMiles) + '-mile presumption window (demo rule).';
    } else if (w.state === 'missed') {
      windowLine = 'First repair falls outside the ' + w.limitMonths + '-month / ' + fmtMiles(w.limitMiles) +
        '-mile presumption window (demo rule) — presumption likely unavailable; claim viability is an attorney call.';
    } else {
      windowLine = 'Presumption window cannot be confirmed from current inputs — dates or mileage figures missing.';
    }

    var nextStep;
    if (assessment.verdict === 'STRONG') {
      nextStep = 'Route to attorney review for engagement decision. Collect the checklist items marked missing before the call.';
    } else if (assessment.verdict === 'PROMISING') {
      nextStep = 'Hold for documentation. Request the items marked missing (repair orders, warranty booklet), then re-run assessment before attorney review.';
    } else {
      nextStep = 'Attorney to confirm decline. If declining, send the standard non-engagement letter (demo placeholder).';
    }

    var lines;
    if (mockVariant === 0) {
      lines = [
        'INTAKE SUMMARY — ' + (caseData.contact.name || 'Prospective client'),
        '',
        'Vehicle: ' + veh + ' (' + (v.condition || '—') + ', ' + (v.purchaseType || '—') + '), delivered ' + (v.purchaseDate || '—') + ' at ' + fmtMiles(v.mileageAtPurchase) + ' mi. Current: ' + fmtMiles(v.currentMileage) + ' mi.',
        'Reported defect: ' + (caseData.problem.description || '—'),
        'Safety-related: ' + (caseData.problem.safetyRelated || '—') + '. Manufacturer warranty: ' + (caseData.warranty.active || '—') + '.',
        '',
        'Repair history: ' + attempts + ' attempt(s) for the primary defect; ' + days + ' cumulative day(s) out of service.',
        windowLine,
        '',
        'Screen result: ' + assessment.verdictLabel + ' (rules v' + assessment.audit.ruleVersion + ', demo thresholds — verify with counsel).',
        'Recommended next step: ' + nextStep
      ];
    } else {
      lines = [
        'INTAKE SUMMARY — ' + (caseData.contact.name || 'Prospective client'),
        '',
        (caseData.contact.name || 'Client') + ' presents a ' + veh + ' (' + (v.purchaseType || '—') + ', delivered ' + (v.purchaseDate || '—') + '). Primary complaint: ' + (caseData.problem.description || '—'),
        '',
        'History shows ' + attempts + ' repair attempt(s) and ' + days + ' day(s) out of service. Safety classification: ' + (caseData.problem.safetyRelated || '—') + '. Warranty status: ' + (caseData.warranty.active || '—') + '.',
        windowLine,
        '',
        'Preliminary screen: ' + assessment.verdictLabel + '. Demo rules v' + assessment.audit.ruleVersion + ' — thresholds require attorney validation.',
        'Next step: ' + nextStep
      ];
    }

    return lines.join('\n');
  }

  /* Live mode — browser call for local demo use only. */
  function buildLiveSummary(caseData, assessment, apiKey) {
    var prompt =
      'You are drafting a 30-second-read intake summary for a California lemon law attorney. ' +
      'Use ONLY the structured data below. Do not invent facts. Do not give legal advice. ' +
      'End with the recommended next step. Note that the screening rules are demo thresholds pending attorney validation.\n\n' +
      'CASE DATA:\n' + JSON.stringify({ contact: caseData.contact, vehicle: caseData.vehicle, warranty: caseData.warranty, problem: caseData.problem, repairs: caseData.repairs }, null, 2) +
      '\n\nASSESSMENT:\n' + JSON.stringify({ verdict: assessment.verdictLabel, criteria: assessment.criteria, window: assessment.window, computed: assessment.computed, flags: assessment.flags }, null, 2);

    return fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }]
      })
    }).then(function (r) {
      if (!r.ok) throw new Error('OpenAI API error ' + r.status);
      return r.json();
    }).then(function (data) {
      return data.choices[0].message.content;
    });
  }

  /**
   * generateSummary(caseData, assessment, opts) -> Promise<string>
   * opts: { mode: 'mock'|'live', apiKey?: string }
   */
  function generateSummary(caseData, assessment, opts) {
    opts = opts || {};
    if (opts.mode === 'live') {
      if (!opts.apiKey) {
        return Promise.reject(new Error('Live mode needs an API key. Key is held in memory only — never committed, never persisted. For a real deployment this call moves server-side.'));
      }
      return buildLiveSummary(caseData, assessment, opts.apiKey);
    }
    return Promise.resolve(buildMockSummary(caseData, assessment));
  }

  global.LemonLLM = { generateSummary: generateSummary };

})(typeof window !== 'undefined' ? window : globalThis);
