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

  var MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  /* Pluralization: singular only when n === 1. plur(0)/plur(2) -> plural. */
  function plur(n, word, wordPlural) {
    return n === 1 ? word : (wordPlural || word + 's');
  }
  function qty(n, word, wordPlural) {
    return n + ' ' + plur(n, word, wordPlural);
  }

  /* ISO YYYY-MM-DD -> "January 20, 2025". Non-ISO input returned as-is. */
  function proseDate(iso) {
    if (!iso) return null;
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso).trim());
    if (!m) return String(iso);
    var mi = parseInt(m[2], 10) - 1;
    if (mi < 0 || mi > 11) return String(iso);
    return MONTH_NAMES[mi] + ' ' + parseInt(m[3], 10) + ', ' + m[1];
  }

  /* Comma-grouped integer, or null when unparseable/blank. */
  function commaNum(n) {
    if (n === '' || n === null || n === undefined) return null;
    var v = Number(n);
    return isNaN(v) ? null : v.toLocaleString('en-US');
  }

  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

  function activeConfig(config) {
    if (config) return config;
    return (global.LemonRules && global.LemonRules.RULES_CONFIG) || null;
  }

  /**
   * swingFactor(caseData, assessment, config) -> { key, text } | null
   * Names the single unknown that would most change the outcome. Derived from
   * the assessment and the configured thresholds — no new screening logic. When
   * more than one applies, the most decisive is returned (priority order below).
   */
  function swingFactor(caseData, assessment, config) {
    var cfg = activeConfig(config);
    if (!cfg || !assessment || !assessment.computed) return null;
    var problem = caseData.problem || {};
    var warranty = caseData.warranty || {};
    var vehicle = caseData.vehicle || {};
    var attempts = assessment.computed.attempts;
    var days = assessment.computed.daysOut;
    var safetyT = cfg.criteria.safetyDefectAttempts.threshold;
    var sameT = cfg.criteria.sameDefectAttempts.threshold;
    var daysT = cfg.criteria.daysOutOfService.threshold;
    var pA = cfg.promising.attemptsWithin;
    var pD = cfg.promising.daysWithin;

    /* 1 — safety classification unresolved, attempts already sufficient */
    if (problem.safetyRelated === 'unsure' && attempts >= safetyT) {
      var verb = attempts === 1 ? 'meets' : 'meet';
      return { key: 'safety',
        text: 'Swing factor: safety classification. If counsel finds this defect likely to cause death or serious injury, ' +
          qty(attempts, 'attempt') + ' ' + verb + ' the ' + safetyT + '-attempt threshold and the case qualifies on the presumption.' };
    }
    /* 2 — warranty status unconfirmed */
    if (warranty.active === 'unsure') {
      return { key: 'warranty',
        text: 'Swing factor: warranty status. Coverage turns on the manufacturer warranty; confirm before attorney review.' };
    }
    /* 3 — used vehicle, warranty-at-sale unconfirmed */
    if (vehicle.condition === 'used' && warranty.warrantyIssuedAtSale === 'unsure') {
      return { key: 'usedWarranty',
        text: 'Swing factor: whether a manufacturer warranty issued at sale. Post-Rodriguez this controls coverage.' };
    }
    /* 4 — within the promising margin of a threshold (attempts first, then days).
       Only meaningful when the case does not already qualify; a STRONG case's
       outcome does not turn on one more attempt, so no swing factor applies. */
    if (assessment.verdict !== 'STRONG') {
      var gapA = sameT - attempts;
      if (gapA > 0 && attempts >= sameT - pA) {
        return { key: 'nearAttempts',
          text: 'Swing factor: ' + (gapA === 1 ? 'one further repair attempt' : gapA + ' further repair attempts') +
            ' would meet the ' + sameT + '-attempt threshold.' };
      }
      var gapD = daysT - days;
      if (gapD > 0 && days >= daysT - pD) {
        return { key: 'nearDays',
          text: 'Swing factor: ' + qty(gapD, 'more day') + ' out of service would meet the ' + daysT + '-day threshold.' };
      }
    }
    return null;
  }

  /* Fast-track SOL, formatted for prose. Returns null unless a date exists. */
  function deadlineLine(assessment) {
    var track = assessment.procedural;
    var deadlines = assessment.deadlines;
    if (!track || track.status !== 'fast_track' || !deadlines) return null;
    var sol = null;
    for (var i = 0; i < deadlines.length; i++) {
      if (deadlines[i].id === 'sol') { sol = deadlines[i]; break; }
    }
    if (!sol || !sol.date) return null;
    var rem = sol.daysRemaining;
    var remText = rem < 0
      ? 'passed ' + qty(Math.abs(rem), 'day') + ' ago'
      : qty(rem, 'day') + ' remaining';
    var m = /^Controlled by (.+?)\./.exec(sol.basis || '');
    var ctl = m ? m[1] : (sol.basis || 'configured rule');
    var prefix = (sol.severity === 'warning' || sol.severity === 'critical') ? 'TIME-SENSITIVE — ' : '';
    return prefix + 'Statute of limitations ' + proseDate(sol.date) + ' (' + remText + '), controlled by ' + ctl;
  }

  function nextStepFor(assessment) {
    if (assessment.verdict === 'STRONG') {
      return 'Route to attorney review for the engagement decision. Collect the checklist items marked missing before the call.';
    }
    if (assessment.verdict === 'PROMISING') {
      return 'Hold for documentation. Request the items marked missing (repair orders, warranty booklet), then re-run the assessment before attorney review.';
    }
    return 'Attorney to confirm the decline. If declining, send the standard non-engagement letter (demo placeholder).';
  }

  function windowLineFor(w) {
    if (w.state === 'met') {
      return 'First repair at about ' + qty(w.monthsToFirstRepair, 'month') + ' and ' +
        (commaNum(w.milesDeltaAtFirstRepair) || '—') + ' miles from delivery — inside the ' +
        w.limitMonths + '-month / ' + (commaNum(w.limitMiles) || w.limitMiles) + '-mile presumption window (demo rule)';
    }
    if (w.state === 'missed') {
      return 'First repair falls outside the ' + w.limitMonths + '-month / ' + (commaNum(w.limitMiles) || w.limitMiles) +
        '-mile presumption window (demo rule) — presumption likely unavailable; claim viability is an attorney call';
    }
    return 'Presumption window cannot be confirmed from current inputs — dates or mileage figures are missing';
  }

  function buildMockSummary(caseData, assessment, config) {
    mockVariant = (mockVariant + 1) % 2;
    var v = caseData.vehicle || {};
    var contact = caseData.contact || {};
    var problem = caseData.problem || {};
    var warranty = caseData.warranty || {};

    var veh = [v.year, v.make, v.model].filter(Boolean).join(' ') || 'Vehicle (unspecified)';
    var acquired = v.purchaseType === 'lease' ? 'Leased' : v.purchaseType === 'purchase' ? 'Purchased' : null;
    var attempts = assessment.computed.attempts;
    var days = assessment.computed.daysOut;

    var delivered = proseDate(v.purchaseDate);
    var mileDelivery = commaNum(v.mileageAtPurchase);
    var mileCurrent = commaNum(v.currentMileage);
    var window = windowLineFor(assessment.window);

    var swing = swingFactor(caseData, assessment, config);
    var deadline = deadlineLine(assessment);
    var flags = assessment.flags || [];
    var caveat = 'rules v' + assessment.audit.ruleVersion + ', demo thresholds pending attorney validation';
    var screen = assessment.verdictLabel;
    var procedural = assessment.procedural
      ? assessment.procedural.label + (assessment.procedural.detail ? ' — ' + assessment.procedural.detail : '')
      : null;
    var nextStep = nextStepFor(assessment);

    var LEAD_LABELS = { google: 'Google Ads', meta: 'Meta', tiktok: 'TikTok', organic: 'Organic search', phone: 'Phone', referral: 'Referral' };
    var src = caseData.leadSource;
    var srcLine = src ? ('Lead source: ' + (LEAD_LABELS[src] || src) + (caseData.utm ? ' (' + caseData.utm + ')' : '')) : null;
    var spanishFlag = caseData.language === 'es' ? 'Client prefers Spanish — route to bilingual staff.' : null;

    var contactBits = [];
    if (contact.name) contactBits.push(contact.name);
    if (contact.phone) contactBits.push(contact.phone);
    if (contact.city) contactBits.push(contact.city);
    var contactLine = contactBits.length ? 'Contact: ' + contactBits.join(' · ') : null;

    var mileTail = (mileDelivery ? mileDelivery + ' miles at delivery' : null);
    if (mileCurrent) mileTail = (mileTail ? mileTail + ', ' : '') + mileCurrent + ' miles now';

    var lines = [];
    function push(s) { lines.push(s); }

    if (mockVariant === 0) {
      push('INTAKE SUMMARY — ' + (contact.name || 'Prospective client'));
      push('');
      if (contactLine) push(contactLine);
      push('Vehicle: ' + veh);
      push([acquired || 'Acquisition unspecified', cap(v.condition) || null, delivered ? 'delivered ' + delivered : null, mileTail]
        .filter(Boolean).join('  ·  '));
      push('Reported defect: ' + (problem.description || '—'));
      push('Safety-related: ' + (problem.safetyRelated || '—') + '  ·  Manufacturer warranty: ' + (warranty.active || '—'));
      if (srcLine) push(srcLine);
      if (spanishFlag) push(spanishFlag);
      push('');
      push('Repair history: ' + qty(attempts, 'attempt') + ' for the primary defect; ' + qty(days, 'day') + ' out of service');
      push(window);
      push('');
      push('Screen result: ' + screen + ' (' + caveat + ')');
      if (swing) push(swing.text);
      if (deadline) push(deadline);
      if (procedural) push('Procedural track: ' + procedural);
      if (flags.length) { push(''); push('Open items:'); flags.forEach(function (f) { push('  • ' + f); }); }
      push('');
      push('Recommended next step: ' + nextStep);
    } else {
      push('INTAKE SUMMARY — ' + (contact.name || 'Prospective client'));
      push('');
      push((contact.name || 'The client') + ' presents a ' + veh +
        (acquired ? ', ' + acquired.toLowerCase() : '') +
        (delivered ? ', delivered ' + delivered : '') +
        (mileTail ? ' (' + mileTail + ')' : '') + '.');
      if (contactLine) push(contactLine);
      push('');
      push('Primary complaint: ' + (problem.description || '—'));
      push('Repair record: ' + qty(attempts, 'attempt') + ' and ' + qty(days, 'day') + ' out of service. ' +
        'Safety classification ' + (problem.safetyRelated || '—') + '; warranty ' + (warranty.active || '—') + '.');
      if (srcLine) push(srcLine);
      if (spanishFlag) push(spanishFlag);
      push(window);
      push('');
      push('Preliminary screen: ' + screen + ' — ' + caveat + '.');
      if (swing) push(swing.text);
      if (deadline) push(deadline);
      if (procedural) push('Track: ' + procedural);
      if (flags.length) { push(''); push('Open items for counsel:'); flags.forEach(function (f) { push('  – ' + f); }); }
      push('');
      push('Next step: ' + nextStep);
    }

    return lines.join('\n');
  }

  /* Live mode — browser call for local demo use only. */
  function buildLiveSummary(caseData, assessment, apiKey, config) {
    var swing = swingFactor(caseData, assessment, config);
    var deadline = deadlineLine(assessment);
    var prompt =
      'You are drafting a 30-second-read intake summary for a California lemon law attorney. ' +
      'Use ONLY the structured data below. Do not invent facts. Do not give legal advice or state a legal conclusion — ' +
      'report the screening result and name what counsel must decide. ' +
      'Note that the screening rules are demo thresholds pending attorney validation. ' +
      'Use full month-name dates (e.g. "January 20, 2025") and comma-grouped mileage. Say "Leased" or "Purchased" plainly. ' +
      (swing ? 'Include this swing-factor line verbatim, immediately after the screen result: "' + swing.text + '". ' : '') +
      (deadline ? 'Include this deadline line: "' + deadline + '". ' : '') +
      'If there are open items, list them under an "Open items:" heading, one per line, unreworded. ' +
      'Include a "Lead source:" line with the source and any UTM string. ' +
      (caseData.language === 'es' ? 'Include the line "Client prefers Spanish — route to bilingual staff." ' : '') +
      'End with the recommended next step.\n\n' +
      'CASE DATA:\n' + JSON.stringify({ contact: caseData.contact, vehicle: caseData.vehicle, warranty: caseData.warranty, problem: caseData.problem, repairs: caseData.repairs, leadSource: caseData.leadSource, utm: caseData.utm, language: caseData.language }, null, 2) +
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
      return buildLiveSummary(caseData, assessment, opts.apiKey, opts.config);
    }
    return Promise.resolve(buildMockSummary(caseData, assessment, opts.config));
  }

  /* =========================================================================
   * Missing-documents request generator.
   *
   * Builds a client-ready message requesting ONLY the checklist items marked
   * missing or requested. It never states or implies a qualification outcome,
   * never gives legal advice, and is never transmitted — it is a draft for
   * staff review. Same human-approval pattern as the attorney summary.
   * ========================================================================= */

  /* The one line every draft carries: who it is from and how to reply. */
  var TEAM_LINE = 'This message is prepared by the firm’s intake team. You can reply directly to this message with the documents.';

  function documentRequestItems(checklist) {
    return (checklist || []).filter(function (it) {
      return it && (it.status === 'missing' || it.status === 'requested');
    });
  }

  function requestGreeting(caseData) {
    var name = (caseData && caseData.contact && caseData.contact.name)
      ? String(caseData.contact.name).trim() : '';
    var first = name ? name.split(/\s+/)[0] : '';
    return first ? 'Hi ' + first + ',' : 'Hello,';
  }

  /**
   * buildMockDocumentRequest(checklist, caseData, format) -> string
   * format: 'email' (default) | 'text'. Deterministic — offline demo path.
   * Returns '' when there is nothing to request.
   */
  function buildMockDocumentRequest(checklist, caseData, format) {
    var items = documentRequestItems(checklist);
    if (!items.length) return '';
    var labels = items.map(function (it) { return it.label; });

    if (format === 'text') {
      var lead = requestGreeting(caseData) +
        ' To keep your file moving, the firm’s intake team needs a few documents: ';
      var tail = '. Reply here with them — thank you.';
      var full = lead + labels.join('; ') + tail;
      if (full.length <= 320) return full;
      /* Too many/long to itemize inside 320 chars — send a count-based note. */
      var alt = requestGreeting(caseData) + ' The firm’s intake team needs ' + labels.length +
        ' document(s) to continue your file. Please reply here and we’ll send the itemized list — thank you.';
      return alt.length <= 320 ? alt : alt.slice(0, 317) + '…';
    }

    var lines = [
      'Subject: Documents needed to continue your review',
      '',
      requestGreeting(caseData),
      '',
      'To continue reviewing your file, the firm’s intake team is requesting the following documents:',
      ''
    ];
    labels.forEach(function (l) { lines.push('  • ' + l); });
    lines.push('');
    lines.push('If you have any of these on hand, a clear photo or scan is fine.');
    lines.push('');
    lines.push(TEAM_LINE);
    lines.push('');
    lines.push('Thank you.');
    return lines.join('\n');
  }

  /* Live mode — browser call for local demo use only. Constrained to a
   * document request; the model is told not to assess the case. */
  function buildLiveDocumentRequest(checklist, caseData, apiKey, format) {
    var labels = documentRequestItems(checklist).map(function (it) { return it.label; });
    var prompt =
      'Draft a short, friendly ' + (format === 'text' ? 'text message' : 'email') +
      ' from a law firm’s intake team to a prospective client, requesting ONLY the documents listed below. ' +
      'Do NOT assess the case, do NOT say whether it qualifies, do NOT give legal advice, do NOT mention lemon law outcomes. ' +
      'Ask for the documents and nothing else. Note the message is from the intake team and that they can reply directly with the documents. ' +
      (format === 'text' ? 'Keep it under 320 characters. ' : 'Include a subject line. ') +
      '\n\nDOCUMENTS REQUESTED:\n' + labels.map(function (l) { return '- ' + l; }).join('\n');

    return fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 300,
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
   * generateDocumentRequest(checklist, caseData, opts) -> Promise<string>
   * opts: { mode: 'mock'|'live', apiKey?: string, format: 'email'|'text' }
   */
  function generateDocumentRequest(checklist, caseData, opts) {
    opts = opts || {};
    var format = opts.format === 'text' ? 'text' : 'email';
    if (documentRequestItems(checklist).length === 0) {
      return Promise.resolve('');
    }
    if (opts.mode === 'live') {
      if (!opts.apiKey) {
        return Promise.reject(new Error('Live mode needs an API key. Key is held in memory only — never committed, never persisted. For a real deployment this call moves server-side.'));
      }
      return buildLiveDocumentRequest(checklist, caseData, opts.apiKey, format);
    }
    return Promise.resolve(buildMockDocumentRequest(checklist, caseData, format));
  }

  global.LemonLLM = {
    generateSummary: generateSummary,
    generateDocumentRequest: generateDocumentRequest,
    buildMockDocumentRequest: buildMockDocumentRequest,
    documentRequestItems: documentRequestItems,
    swingFactor: swingFactor,
    plur: plur,
    buildMockSummary: buildMockSummary
  };

})(typeof window !== 'undefined' ? window : globalThis);
