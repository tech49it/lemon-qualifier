/* =========================================================================
 * app.js — UI state and rendering. No business logic here: qualification
 * lives in rules.js, summary generation in llm.js, data in sampleCases.js.
 * ========================================================================= */

(function () {
  'use strict';

  var Rules = window.LemonRules;
  var Samples = window.LemonSamples;
  var LLM = window.LemonLLM;

  var DISCLAIMER = 'Demo — preliminary screening only. Attorney review required. Rules are illustrative; verify current statute.';

  /* ------------------------------ state ---------------------------------- */

  var state = {
    activeCaseId: null,
    caseData: null,
    config: JSON.parse(JSON.stringify(Rules.RULES_CONFIG)),
    checklist: [],           // [{id, label, status}]
    summary: { text: '', reviewed: false, reviewedAt: null, generating: false, error: null },
    docRequest: { text: '', reviewed: false, reviewedAt: null, generating: false, error: null, format: null },
    docReqOpen: false,       // missing-docs request section collapsed by default
    llmMode: 'mock',         // 'mock' | 'live'
    apiKey: '',              // memory only — never persisted
    rulesOpen: false
  };

  /* ------------------------------ utils ---------------------------------- */

  function $(sel) { return document.querySelector(sel); }
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') node.className = attrs[k];
      else if (k === 'text') node.textContent = attrs[k];
      else if (k.indexOf('on') === 0) node.addEventListener(k.slice(2), attrs[k]);
      else node.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) node.appendChild(c); });
    return node;
  }
  function fmtMiles(n) { var v = Number(n); return isNaN(v) || n === '' || n === null ? '—' : v.toLocaleString(); }
  function nowStamp() {
    return new Date().toLocaleString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  /* --------------------------- case loading ------------------------------ */

  function loadCase(caseId) {
    var src = caseId === 'case-new'
      ? Samples.blankCase()
      : Samples.SAMPLE_CASES.filter(function (c) { return c.id === caseId; })[0];
    if (!src) return;
    state.activeCaseId = caseId;
    state.caseData = JSON.parse(JSON.stringify(src));
    state.summary = { text: '', reviewed: false, reviewedAt: null, generating: false, error: null };
    state.docRequest = { text: '', reviewed: false, reviewedAt: null, generating: false, error: null, format: null };
    buildChecklist();
    renderAll();
  }

  /* --------------------------- checklist --------------------------------- */

  function buildChecklist() {
    var c = state.caseData;
    var items = [];
    (c.repairs || []).forEach(function (r, i) {
      items.push({
        id: 'ro-' + i,
        label: 'Repair order — visit ' + (i + 1) + (r.dateIn ? ' (' + r.dateIn + ')' : ''),
        status: 'missing'
      });
    });
    items.push({ id: 'contract', label: (c.vehicle.purchaseType === 'lease' ? 'Lease agreement' : 'Purchase contract'), status: 'missing' });
    items.push({ id: 'warranty', label: 'Warranty booklet / coverage statement', status: 'missing' });
    items.push({ id: 'registration', label: 'Current vehicle registration', status: 'missing' });
    items.push({ id: 'mfr-comms', label: 'Communications with manufacturer (letters, emails, case numbers)', status: 'missing' });

    /* Sample cases start with realistic mixed statuses so the panel reads true */
    if (state.activeCaseId === 'case-strong') {
      items.forEach(function (it) { it.status = it.id.indexOf('ro-') === 0 ? 'collected' : 'requested'; });
      items[items.length - 1].status = 'missing';
    } else if (state.activeCaseId === 'case-borderline') {
      items.forEach(function (it, i) { it.status = i === 0 ? 'collected' : 'missing'; });
      items[1] && (items[1].status = 'requested');
    }
    state.checklist = items;
  }

  var STATUS_CYCLE = { missing: 'requested', requested: 'collected', collected: 'missing' };

  /* --------------------------- rendering --------------------------------- */

  function renderAll() {
    renderChips();
    renderForm();
    renderRulesPanel();
    renderOutputs();
  }

  function renderChips() {
    var wrap = $('#case-chips');
    wrap.innerHTML = '';
    Samples.SAMPLE_CASES.forEach(function (c) {
      var chip = el('button', {
        class: 'chip' + (state.activeCaseId === c.id ? ' active' : ''),
        onclick: function () { loadCase(c.id); }
      });
      chip.appendChild(document.createTextNode(c.label));
      chip.appendChild(el('span', { class: 'chip-hint', text: c.hint }));
      wrap.appendChild(chip);
    });
    wrap.appendChild(el('button', {
      class: 'chip' + (state.activeCaseId === 'case-new' ? ' active' : ''),
      text: '+ New case',
      onclick: function () { loadCase('case-new'); }
    }));
  }

  /* ------ form ------ */

  function field(labelText, inputNode, wide) {
    return el('div', { class: 'field' + (wide ? ' wide' : '') }, [
      el('label', { text: labelText }),
      inputNode
    ]);
  }

  function textInput(obj, key, opts) {
    opts = opts || {};
    var input = el('input', {
      type: opts.type || 'text',
      value: obj[key] == null ? '' : obj[key],
      oninput: function (e) { obj[key] = e.target.value; onCaseEdited(opts.rebuildChecklist); }
    });
    if (opts.placeholder) input.placeholder = opts.placeholder;
    return input;
  }

  function selectInput(obj, key, options, rebuildChecklist) {
    var sel = el('select', {
      onchange: function (e) { obj[key] = e.target.value; onCaseEdited(rebuildChecklist); }
    });
    options.forEach(function (o) {
      var opt = el('option', { value: o[0], text: o[1] });
      if (obj[key] === o[0]) opt.selected = true;
      sel.appendChild(opt);
    });
    return sel;
  }

  function onCaseEdited(rebuildChecklist) {
    state.summary.reviewed = false;    /* inputs changed — any prior review no longer covers them */
    state.docRequest.reviewed = false; /* the request draft was reviewed against the old inputs */
    if (rebuildChecklist) { buildChecklist(); }
    renderComputedStrip();
    renderAssessment();
    renderTrackPanel();
    renderChecklistPanel();            /* reflect the revoked doc-request review + any rebuilt items */
    renderSummaryPanel();
  }

  function renderForm() {
    var c = state.caseData;
    var root = $('#intake-form');
    root.innerHTML = '';

    /* Vehicle */
    root.appendChild(el('div', { class: 'form-section-title', text: 'Vehicle' }));
    var vg = el('div', { class: 'field-grid' });
    vg.appendChild(field('Year', textInput(c.vehicle, 'year')));
    vg.appendChild(field('Make', textInput(c.vehicle, 'make')));
    vg.appendChild(field('Model', textInput(c.vehicle, 'model')));
    var condSel = el('select', {
      onchange: function (e) {
        c.vehicle.condition = e.target.value;
        renderForm();
        onCaseEdited();
      }
    });
    [['new', 'New'], ['used', 'Used']].forEach(function (o) {
      var opt = el('option', { value: o[0], text: o[1] });
      if (c.vehicle.condition === o[0]) opt.selected = true;
      condSel.appendChild(opt);
    });
    vg.appendChild(field('Condition', condSel));
    vg.appendChild(field('Purchase type', selectInput(c.vehicle, 'purchaseType', [['purchase', 'Purchase'], ['lease', 'Lease']], true)));
    vg.appendChild(field('Purchase / delivery date', textInput(c.vehicle, 'purchaseDate', { type: 'date' })));
    vg.appendChild(field('Dealer', textInput(c.vehicle, 'dealer'), true));
    vg.appendChild(field('Mileage at purchase', textInput(c.vehicle, 'mileageAtPurchase', { type: 'number' })));
    vg.appendChild(field('Current mileage', textInput(c.vehicle, 'currentMileage', { type: 'number' })));
    var vinInput = el('input', {
      type: 'text', maxlength: '17', value: c.vehicle.vin || '',
      oninput: function (e) {
        e.target.value = e.target.value.toUpperCase();
        c.vehicle.vin = e.target.value;
        onCaseEdited();
      }
    });
    vinInput.placeholder = 'Optional \u2014 enables recall lookup';
    vg.appendChild(field('VIN', vinInput, true));
    root.appendChild(vg);

    /* Warranty */
    root.appendChild(el('div', { class: 'form-section-title', text: 'Warranty' }));
    var wg = el('div', { class: 'field-grid' });
    wg.appendChild(field('Manufacturer warranty active?', selectInput(c.warranty, 'active', [['yes', 'Yes'], ['no', 'No'], ['unsure', 'Unsure']])));
    wg.appendChild(field('Warranty type', textInput(c.warranty, 'type')));
    wg.appendChild(field('Warranty expiration date', textInput(c.warranty, 'expirationDate', { type: 'date' })));
    if (c.vehicle.condition === 'used') {
      wg.appendChild(field('Manufacturer warranty issued at sale?',
        selectInput(c.warranty, 'warrantyIssuedAtSale', [['yes', 'Yes'], ['no', 'No'], ['unsure', 'Unsure']])));
    }
    root.appendChild(wg);

    /* Problem */
    root.appendChild(el('div', { class: 'form-section-title', text: 'Problem' }));
    var pg = el('div', { class: 'field-grid' });
    var ta = el('textarea', {
      oninput: function (e) { c.problem.description = e.target.value; onCaseEdited(); }
    });
    ta.value = c.problem.description || '';
    pg.appendChild(field('Defect description', ta, true));
    pg.appendChild(field('Affects safety?', selectInput(c.problem, 'safetyRelated', [['yes', 'Yes'], ['no', 'No'], ['unsure', 'Unsure']])));
    root.appendChild(pg);

    /* Repair history */
    root.appendChild(el('div', { class: 'form-section-title', text: 'Repair history' }));
    var repairsWrap = el('div', { id: 'repairs-wrap' });
    root.appendChild(repairsWrap);
    renderRepairRows(repairsWrap);
    root.appendChild(el('button', {
      class: 'btn secondary small', text: '+ Add repair visit',
      onclick: function () {
        c.repairs.push({ dateIn: '', dateOut: '', mileage: '', shop: '', reported: '', done: '', resolved: false, samePrimaryDefect: true });
        renderRepairRows(repairsWrap);
        onCaseEdited(true);
      }
    }));

    /* Computed strip */
    root.appendChild(el('div', { class: 'computed-strip', id: 'computed-strip' }));
    renderComputedStrip();

    /* Contact */
    root.appendChild(el('div', { class: 'form-section-title', text: 'Contact (fake data only)' }));
    var cg = el('div', { class: 'field-grid' });
    cg.appendChild(field('Name', textInput(c.contact, 'name')));
    cg.appendChild(field('Phone', textInput(c.contact, 'phone')));
    cg.appendChild(field('Email', textInput(c.contact, 'email')));
    cg.appendChild(field('City', textInput(c.contact, 'city')));
    root.appendChild(cg);
  }

  function renderRepairRows(wrap) {
    var c = state.caseData;
    wrap.innerHTML = '';
    c.repairs.forEach(function (r, i) {
      var row = el('div', { class: 'repair-row' });
      var head = el('div', { class: 'repair-row-head' }, [
        el('span', { class: 'repair-row-title', text: 'Visit ' + (i + 1) }),
        el('button', {
          class: 'link-btn', text: 'Remove',
          onclick: function () {
            c.repairs.splice(i, 1);
            renderRepairRows(wrap);
            onCaseEdited(true);
          }
        })
      ]);
      row.appendChild(head);

      var g = el('div', { class: 'field-grid' });
      g.appendChild(field('Date in', textInput(r, 'dateIn', { type: 'date', rebuildChecklist: true })));
      g.appendChild(field('Date out', textInput(r, 'dateOut', { type: 'date' })));
      g.appendChild(field('Mileage at visit', textInput(r, 'mileage', { type: 'number' })));
      g.appendChild(field('Dealer / shop', textInput(r, 'shop')));
      g.appendChild(field('What was reported', textInput(r, 'reported'), true));
      g.appendChild(field('What was done', textInput(r, 'done'), true));
      g.appendChild(field('Resolved?', selectInput(r, 'resolved', [[false, 'No'], [true, 'Yes']])));
      row.appendChild(g);

      var cb = el('input', {
        type: 'checkbox',
        onchange: function (e) { r.samePrimaryDefect = e.target.checked; onCaseEdited(); }
      });
      cb.checked = r.samePrimaryDefect !== false;
      row.appendChild(el('label', { class: 'checkbox-line' }, [cb, el('span', { text: 'Same primary defect as reported problem' })]));

      wrap.appendChild(row);
    });
  }

  function renderComputedStrip() {
    var strip = $('#computed-strip');
    if (!strip) return;
    var d = Rules.computeDerived(state.caseData);
    strip.innerHTML = '';
    strip.appendChild(el('div', { class: 'computed-item' }, [
      el('span', { class: 'val', text: String(d.attempts) }),
      el('span', { text: 'repair attempts (primary defect)' })
    ]));
    strip.appendChild(el('div', { class: 'computed-item' }, [
      el('span', { class: 'val', text: String(d.daysOut) + (d.daysUnknown ? '+' : '') }),
      el('span', { text: 'cumulative days out of service' })
    ]));
  }

  /* ------ rules panel ------ */

  function renderRulesPanel() {
    var panel = $('#rules-panel');
    panel.classList.toggle('hidden', !state.rulesOpen);
    $('#rules-toggle').textContent = state.rulesOpen
      ? 'Hide rules (v' + state.config.version + ')'
      : 'Rules v' + state.config.version + ' — view / edit';
    if (!state.rulesOpen) return;

    var body = $('#rules-body');
    body.innerHTML = '';
    var grid = el('div', { class: 'rules-grid' });

    function ruleRow(labelText, get, set) {
      var name = el('div', { class: 'rule-name' });
      name.appendChild(document.createTextNode(labelText));
      name.appendChild(el('span', { class: 'verify-tag', text: 'VERIFY WITH COUNSEL' }));
      grid.appendChild(name);
      grid.appendChild(el('input', {
        type: 'number', value: get(),
        oninput: function (e) {
          var v = Number(e.target.value);
          if (!isNaN(v) && v >= 0) { set(v); onRulesEdited(); }
        }
      }));
    }

    var cfg = state.config;
    ruleRow('Safety-defect repair attempts (threshold)', function () { return cfg.criteria.safetyDefectAttempts.threshold; }, function (v) { cfg.criteria.safetyDefectAttempts.threshold = v; });
    ruleRow('Same-defect repair attempts (threshold)', function () { return cfg.criteria.sameDefectAttempts.threshold; }, function (v) { cfg.criteria.sameDefectAttempts.threshold = v; });
    ruleRow('Cumulative days out of service (threshold)', function () { return cfg.criteria.daysOutOfService.threshold; }, function (v) { cfg.criteria.daysOutOfService.threshold = v; });
    ruleRow('Presumption window — months from delivery', function () { return cfg.presumptionWindow.months; }, function (v) { cfg.presumptionWindow.months = v; });
    ruleRow('Presumption window — miles from delivery', function () { return cfg.presumptionWindow.miles; }, function (v) { cfg.presumptionWindow.miles = v; });

    body.appendChild(grid);

    /* ---- Procedural track intervals ---- */
    body.appendChild(el('div', { class: 'form-section-title', text: 'Procedural track (AB 1755 / SB 26)' }));
    var pgrid = el('div', { class: 'rules-grid' });
    var pt = cfg.proceduralTracks;

    function pRow(labelText, get, set) {
      var name = el('div', { class: 'rule-name' });
      name.appendChild(document.createTextNode(labelText));
      name.appendChild(el('span', { class: 'verify-tag', text: 'VERIFY WITH COUNSEL' }));
      pgrid.appendChild(name);
      pgrid.appendChild(el('input', {
        type: 'number', value: get(),
        oninput: function (e) {
          var v = Number(e.target.value);
          if (!isNaN(v) && v >= 0) { set(v); onRulesEdited(); }
        }
      }));
    }

    pRow('Pre-suit notice (days)', function () { return pt.fastTrack.presuitNoticeDays; }, function (v) { pt.fastTrack.presuitNoticeDays = v; });
    pRow('Mediation window (days from answer)', function () { return pt.fastTrack.mediationWindowDays; }, function (v) { pt.fastTrack.mediationWindowDays = v; });
    pRow('SOL \u2014 years after warranty expiry', function () { return pt.fastTrack.solYearsAfterWarrantyExpiry; }, function (v) { pt.fastTrack.solYearsAfterWarrantyExpiry = v; });
    pRow('SOL cap \u2014 years from delivery', function () { return pt.fastTrack.solCapYearsFromDelivery; }, function (v) { pt.fastTrack.solCapYearsFromDelivery = v; });
    pRow('Warn this many days before SOL', function () { return pt.warnDaysBeforeSol; }, function (v) { pt.warnDaysBeforeSol = v; });
    body.appendChild(pgrid);

    /* ---- Manufacturer opt-in registry ---- */
    body.appendChild(el('div', { class: 'form-section-title', text: 'Manufacturer opt-in registry' }));

    var reg = cfg.manufacturerRegistry;
    var regKeys = Object.keys(reg);

    if (regKeys.length === 0) {
      body.appendChild(el('p', {
        class: 'criterion-detail',
        style: 'margin:0 0 10px;',
        text: 'Empty by design. The firm\u2019s attorneys maintain this list \u2014 the system does not guess which manufacturers elected into the fast-track procedures. Once populated, every case routes automatically.'
      }));
    } else {
      regKeys.sort().forEach(function (k) {
        body.appendChild(el('div', { class: 'check-item' }, [
          el('span', { text: k + (reg[k].optedIn ? '  \u2014 opted in' : '  \u2014 traditional') }),
          el('button', {
            class: 'link-btn', text: 'Remove',
            onclick: function () { delete reg[k]; onRulesEdited(); renderRulesPanel(); }
          })
        ]));
      });
    }

    var nameInput = el('input', { type: 'text', style: 'flex:1;' });
    nameInput.placeholder = 'Manufacturer name';
    var optedBox = el('input', { type: 'checkbox' });
    optedBox.checked = true;
    var addRow = el('div', { class: 'api-key-row' }, [
      nameInput,
      el('label', { class: 'checkbox-line', style: 'margin:0;' }, [optedBox, el('span', { text: 'Opted in' })]),
      el('button', {
        class: 'btn secondary small', text: 'Add',
        onclick: function () {
          var k = nameInput.value.trim().toLowerCase();
          if (!k) return;
          reg[k] = { optedIn: optedBox.checked };
          nameInput.value = '';
          onRulesEdited();
          renderRulesPanel();
        }
      })
    ]);
    body.appendChild(addRow);
    body.appendChild(el('p', {
      class: 'rules-note',
      style: 'margin-top:8px;',
      text: 'In-memory for this demo. In production, registry changes are versioned, attorney-approved, and audit-logged like any other rule change.'
    }));

    body.appendChild(el('p', {
      class: 'rules-note',
      text: 'These thresholds are demo values drawn from the Civil Code \u00a7 793.22 presumption guideline and are not legal advice. In production, edits are versioned, attorney-approved, and audit-logged. The firm\u2019s attorneys own these numbers; the system enforces whatever they decide.'
    }));
  }

  function onRulesEdited() {
    state.config.version = state.config.version.indexOf('-edited') === -1
      ? state.config.version + '-edited'
      : state.config.version;
    state.summary.reviewed = false;
    renderAssessment();
    renderTrackPanel();
    renderSummaryPanel();
    $('#rules-toggle').textContent = 'Hide rules (v' + state.config.version + ')';
  }

  /* ------ outputs ------ */

  function renderOutputs() {
    renderAssessment();
    renderTrackPanel();
    renderChecklistPanel();
    renderSummaryPanel();
  }

  function renderAssessment() {
    var a = Rules.evaluateCase(state.caseData, state.config);
    state.lastAssessment = a;
    var body = $('#assessment-body');
    body.innerHTML = '';

    body.appendChild(el('div', { class: 'verdict ' + a.verdict, text: a.verdictLabel }));

    /* Repair timeline strip — rendering only; positions/totals come from rules.js */
    body.appendChild(buildTimelineNode());

    /* Presumption window line */
    var wl = el('div', { class: 'window-line' });
    var stateWord = a.window.state === 'met' ? 'Inside' : a.window.state === 'missed' ? 'Outside' : 'Unconfirmed';
    wl.appendChild(el('span', { class: 'window-state ' + a.window.state, text: stateWord }));
    var detail = ' \u2014 presumption window of ' + a.window.limitMonths + ' months / ' + fmtMiles(a.window.limitMiles) + ' miles from delivery.';
    if (a.window.monthsToFirstRepair !== null && a.window.milesDeltaAtFirstRepair !== null) {
      detail += ' First repair at ~' + a.window.monthsToFirstRepair + ' months / ' + fmtMiles(a.window.milesDeltaAtFirstRepair) + ' miles.';
    }
    wl.appendChild(document.createTextNode(detail));
    body.appendChild(wl);

    /* Criteria ledger */
    var ledger = el('div', { class: 'criteria-ledger' });
    a.criteria.forEach(function (cr) {
      ledger.appendChild(el('div', { class: 'criterion' }, [
        el('div', { class: 'criterion-stamp ' + (cr.met ? 'met' : 'miss'), text: cr.met ? 'MET' : (cr.applicable ? 'NOT MET' : 'N/A') }),
        el('div', {}, [
          el('p', { class: 'criterion-label', text: cr.label }),
          el('p', { class: 'criterion-detail', text: cr.detail })
        ])
      ]));
    });
    body.appendChild(ledger);

    /* Flags */
    if (a.flags.length) {
      var ul = el('ul', { class: 'flags' });
      a.flags.forEach(function (f) { ul.appendChild(el('li', { text: f })); });
      body.appendChild(ul);
    }

    body.appendChild(el('div', { class: 'disclaimer' }, [
      el('strong', { text: 'Demo \u2014 preliminary screening only. ' }),
      document.createTextNode('Attorney review required. Rules are illustrative; verify current statute.')
    ]));

    body.appendChild(el('div', {
      class: 'audit-line',
      text: 'Assessed ' + nowStamp() + ' \u00b7 rules v' + a.audit.ruleVersion + ' \u00b7 inputs #' + a.audit.inputsHash + ' \u00b7 mode: local demo'
    }));
  }


  /* ------ repair timeline (rendering only) ------ */

  function pct(f) { return (f * 100) + '%'; }

  function segTitle(s) {
    var head;
    if (s.kind === 'bar') {
      head = (s.dateIn || '?') + ' → ' + (s.dateOut || '?') +
        ' (' + s.days + ' day' + (s.days === 1 ? '' : 's') + ')';
    } else {
      head = 'Incomplete dates — excluded from the days-out total. ' +
        (s.dateIn ? 'In ' + s.dateIn : (s.dateOut ? 'Out ' + s.dateOut : 'No dates recorded'));
    }
    var extra = [];
    if (s.shop) extra.push(s.shop);
    if (s.reported) extra.push(s.reported);
    if (!s.samePrimaryDefect) extra.push('not counted as the primary defect');
    return head + (extra.length ? ' — ' + extra.join(' — ') : '');
  }

  function buildTimelineNode() {
    var t = Rules.buildTimeline(state.caseData, state.config);
    var wrap = el('div', { class: 'timeline-block' });
    wrap.appendChild(el('div', { class: 'timeline-caption', text: 'Repair timeline' }));

    if (!t.hasVisits || !t.hasAxis) {
      wrap.appendChild(el('div', { class: 'timeline-empty', text: 'No repair visits recorded.' }));
      return wrap;
    }

    var track = el('div', { class: 'timeline-track' });

    /* Presumption window: de-emphasize the closed region, then draw the rule */
    if (t.presumption && t.presumption.inRange) {
      if (t.presumption.closed) {
        var past = el('div', { class: 'timeline-past' });
        past.style.left = pct(t.presumption.frac);
        past.style.right = '0';
        track.appendChild(past);
      }
      var rule = el('div', {
        class: 'timeline-rule',
        title: 'Presumption window closes ' + t.presumption.boundaryISO +
          ' (delivery + ' + t.presumption.months + ' months)'
      });
      rule.style.left = pct(t.presumption.frac);
      track.appendChild(rule);
      var lbl = el('div', { class: 'timeline-rule-label', text: 'Presumption window' });
      lbl.style.left = pct(t.presumption.frac);
      track.appendChild(lbl);
    }

    t.segments.forEach(function (s) {
      if (s.kind === 'bar') {
        var bar = el('div', { class: 'timeline-bar', title: segTitle(s) });
        bar.style.left = pct(s.startFrac);
        bar.style.width = pct(s.widthFrac);
        track.appendChild(bar);
      } else {
        var mk = el('div', { class: 'timeline-marker', title: segTitle(s) });
        mk.style.left = pct(s.startFrac);
        track.appendChild(mk);
      }
    });

    wrap.appendChild(track);

    wrap.appendChild(el('div', { class: 'timeline-axis' }, [
      el('span', { text: t.deliveryISO || t.axis.startISO || '' }),
      el('span', { text: t.axis.endISO || '' })
    ]));

    /* Plain-text total, duplicated on purpose — the partner is reading this panel */
    var days = t.totals.daysOut + (t.totals.daysUnknown ? '+' : '');
    wrap.appendChild(el('div', {
      class: 'timeline-totals',
      text: t.totals.attempts + ' repair attempt(s) for the primary defect · ' +
        days + ' cumulative day(s) out of service'
    }));

    return wrap;
  }

  /* ------ procedural track panel ------ */

  var SEV_STYLE = {
    critical: { cls: 'NOT_QUALIFIED', color: 'var(--fail)' },
    warning:  { cls: 'PROMISING',     color: 'var(--caution)' },
    info:     { cls: '',              color: 'var(--ink-soft)' }
  };

  function renderTrackPanel() {
    var body = $('#track-body');
    if (!body) return;
    body.innerHTML = '';

    var track = Rules.resolveTrack(state.caseData, state.config);
    var deadlines = Rules.computeDeadlines(state.caseData, track, state.config);
    var usedScreen = Rules.screenUsedVehicle(state.caseData, state.config);

    /* Track badge */
    var badgeClass = track.status === 'fast_track' ? 'STRONG'
      : track.status === 'traditional' ? 'PROMISING' : 'PROMISING';
    var badge = el('div', { class: 'verdict ' + badgeClass, style: 'font-size:18px;' , text: track.label });
    body.appendChild(badge);

    body.appendChild(el('div', { class: 'window-line', text: track.detail }));

    /* Deadlines */
    var ledger = el('div', { class: 'criteria-ledger' });
    deadlines.forEach(function (d) {
      var sev = SEV_STYLE[d.severity] || SEV_STYLE.info;
      var stampText = d.date
        ? (d.daysRemaining !== null && d.daysRemaining < 0 ? 'PASSED' : String(d.daysRemaining) + 'd')
        : 'N/A';
      var right = el('div', {}, [
        el('p', { class: 'criterion-label', text: d.label }),
        el('p', { class: 'criterion-detail', text: (d.date ? d.date + ' \u00b7 ' : '') + d.basis })
      ]);
      var stamp = el('div', {
        class: 'criterion-stamp ' + (d.severity === 'info' ? 'miss' : 'met'),
        text: stampText
      });
      if (d.severity === 'critical') { stamp.style.color = 'var(--fail)'; stamp.style.background = 'var(--fail-bg)'; }
      if (d.severity === 'warning')  { stamp.style.color = 'var(--caution)'; stamp.style.background = 'var(--caution-bg)'; }
      ledger.appendChild(el('div', { class: 'criterion' }, [stamp, right]));
    });
    body.appendChild(ledger);

    /* Used-vehicle screen */
    if (usedScreen.flagged || usedScreen.message) {
      var ul = el('ul', { class: 'flags' });
      ul.appendChild(el('li', { text: usedScreen.message }));
      body.appendChild(ul);
    }

    body.appendChild(el('div', { class: 'disclaimer' }, [
      el('strong', { text: 'Demo \u2014 preliminary screening only. ' }),
      document.createTextNode('Attorney review required. Rules are illustrative; verify current statute. Dates below are calendar arithmetic on intervals the firm configures \u2014 not a limitations opinion.')
    ]));

    if (state.lastAssessment) {
      body.appendChild(el('div', {
        class: 'audit-line',
        text: 'Track resolved ' + nowStamp() + ' \u00b7 rules v' + state.config.version +
          ' \u00b7 registry entries: ' + Object.keys(state.config.manufacturerRegistry || {}).length
      }));
    }
  }

  function renderChecklistPanel() {
    var body = $('#checklist-body');
    body.innerHTML = '';
    state.checklist.forEach(function (item) {
      var btn = el('button', {
        class: 'status-toggle ' + item.status,
        text: item.status.toUpperCase(),
        onclick: function () {
          item.status = STATUS_CYCLE[item.status];
          state.docRequest.reviewed = false; /* checklist changed — request draft review no longer covers it */
          renderChecklistPanel();
        }
      });
      body.appendChild(el('div', { class: 'check-item' }, [
        el('span', { text: item.label }),
        btn
      ]));
    });
    /* ---- Verification links ---- */
    body.appendChild(el('div', { class: 'form-section-title', text: 'Verification' }));
    body.appendChild(el('p', {
      class: 'criterion-detail',
      style: 'margin:0 0 8px;',
      text: 'Confirm open recalls, prior owner complaints, and technical service bulletins that corroborate the reported defect.'
    }));

    var vin = (state.caseData.vehicle.vin || '').trim();
    if (vin) {
      var vinRow = el('div', { class: 'check-item' }, [
        el('span', { style: 'font-family:var(--font-mono);font-size:12.5px;', text: 'VIN  ' + vin }),
        el('button', {
          class: 'status-toggle',
          text: 'COPY VIN',
          onclick: function (e) {
            try {
              navigator.clipboard.writeText(vin);
              e.target.textContent = 'COPIED';
              setTimeout(function () { e.target.textContent = 'COPY VIN'; }, 1400);
            } catch (err) { /* clipboard unavailable \u2014 VIN is visible above */ }
          }
        })
      ]);
      body.appendChild(vinRow);
    }

    [
      ['NHTSA \u2014 recalls, complaints & TSBs', 'https://www.nhtsa.gov/recalls'],
      ['CA Bureau of Automotive Repair \u2014 shop license & complaints', 'https://www.bar.ca.gov']
    ].forEach(function (pair) {
      var a = el('a', { href: pair[1], target: '_blank', rel: 'noopener noreferrer', text: pair[0] });
      a.style.color = 'var(--focus)';
      a.style.fontSize = '13.5px';
      body.appendChild(el('div', { class: 'check-item' }, [a]));
    });

    body.appendChild(el('div', { class: 'check-item' }, [
      el('span', { style: 'font-size:13.5px;color:var(--ink-soft);', text: 'Manufacturer VIN recall tool \u2014 check the automaker\u2019s own site for open recalls and service campaigns.' })
    ]));

    body.appendChild(el('div', { class: 'disclaimer' }, [
      el('strong', { text: 'Demo \u2014 preliminary screening only. ' }),
      document.createTextNode('Attorney review required. Rules are illustrative; verify current statute. External links are provided for verification only.')
    ]));

    /* ---- Missing-document request (collapsible) ---- */
    renderDocRequestSection(body);
  }

  /* ------ missing-document request ------ */

  function renderDocRequestSection(parent) {
    var items = LLM.documentRequestItems(state.checklist);
    var section = el('div', { class: 'docreq-section' });

    section.appendChild(el('button', {
      class: 'docreq-toggle',
      text: (state.docReqOpen ? '\u25be ' : '\u25b8 ') + 'Missing-document request',
      onclick: function () { state.docReqOpen = !state.docReqOpen; renderChecklistPanel(); }
    }));

    var wrap = el('div', { class: 'docreq-body' + (state.docReqOpen ? '' : ' hidden') });

    if (!items.length) {
      wrap.appendChild(el('p', { class: 'criterion-detail', style: 'margin:0 0 8px;', text: 'All documents collected \u2014 nothing to request.' }));
      var row = el('div', { class: 'summary-actions' });
      var b1 = el('button', { class: 'btn small', text: 'Draft email' });
      var b2 = el('button', { class: 'btn secondary small', text: 'Draft text message' });
      b1.disabled = true; b2.disabled = true;
      row.appendChild(b1); row.appendChild(b2);
      wrap.appendChild(row);
      section.appendChild(wrap);
      parent.appendChild(section);
      return;
    }

    wrap.appendChild(el('p', {
      class: 'criterion-detail', style: 'margin:0 0 8px;',
      text: 'Requesting ' + items.length + ' item(s): ' + items.map(function (i) { return i.label; }).join('; ')
    }));

    var ta = el('textarea', {
      class: 'summary-text',
      oninput: function (e) {
        state.docRequest.text = e.target.value;
        state.docRequest.reviewed = false;
        renderDocRequestActions();
      }
    });
    ta.value = state.docRequest.text;
    ta.placeholder = 'Draft an email or text, then edit here. Nothing is sent \u2014 this is a draft for staff review.';
    wrap.appendChild(ta);

    wrap.appendChild(el('div', { class: 'summary-actions', id: 'docreq-actions' }));

    if (state.docRequest.error) {
      wrap.appendChild(el('div', { class: 'llm-error', text: state.docRequest.error }));
    }

    wrap.appendChild(el('div', { class: 'disclaimer' }, [
      el('strong', { text: 'Demo \u2014 preliminary screening only. ' }),
      document.createTextNode('Attorney review required. Rules are illustrative; verify current statute. This message is a draft for staff review and is not sent by this demo \u2014 nothing is transmitted.')
    ]));

    section.appendChild(wrap);
    parent.appendChild(section);
    renderDocRequestActions();
  }

  function renderDocRequestActions() {
    var wrap = $('#docreq-actions');
    if (!wrap) return;
    wrap.innerHTML = '';
    var gen = state.docRequest.generating;

    wrap.appendChild(el('button', {
      class: 'btn small',
      text: gen && state.docRequest.format === 'email' ? 'Drafting\u2026' : 'Draft email',
      onclick: function () { generateDocRequest('email'); }
    }));
    wrap.appendChild(el('button', {
      class: 'btn secondary small',
      text: gen && state.docRequest.format === 'text' ? 'Drafting\u2026' : 'Draft text message',
      onclick: function () { generateDocRequest('text'); }
    }));

    if (state.docRequest.text && !state.docRequest.reviewed) {
      wrap.appendChild(el('button', {
        class: 'btn secondary small',
        text: 'Mark reviewed & save',
        onclick: function () {
          state.docRequest.reviewed = true;
          state.docRequest.reviewedAt = nowStamp();
          renderDocRequestActions();
        }
      }));
      wrap.appendChild(el('span', { class: 'review-note', text: 'Draft \u2014 not yet reviewed by a human.' }));
    }

    if (state.docRequest.reviewed) {
      wrap.appendChild(el('span', { class: 'review-badge', text: '\u2713 Reviewed ' + state.docRequest.reviewedAt }));
    }

    if (state.docRequest.text) {
      wrap.appendChild(el('button', {
        class: 'btn secondary small',
        text: 'Copy',
        onclick: function (e) {
          try {
            navigator.clipboard.writeText(state.docRequest.text);
            e.target.textContent = 'Copied';
            setTimeout(function () { e.target.textContent = 'Copy'; }, 1400);
          } catch (err) { /* clipboard unavailable \u2014 text is visible above; nothing is transmitted */ }
        }
      }));
    }
  }

  function generateDocRequest(format) {
    if (state.docRequest.generating) return;
    state.docRequest.generating = true;
    state.docRequest.format = format;
    state.docRequest.error = null;
    renderDocRequestActions();

    LLM.generateDocumentRequest(state.checklist, state.caseData, { mode: state.llmMode, apiKey: state.apiKey, format: format })
      .then(function (text) {
        state.docRequest.text = text;
        state.docRequest.reviewed = false;
        state.docRequest.generating = false;
        renderChecklistPanel();
      })
      .catch(function (err) {
        state.docRequest.generating = false;
        state.docRequest.error = err.message;
        renderChecklistPanel();
      });
  }

  function renderSummaryPanel() {
    var body = $('#summary-body');
    body.innerHTML = '';

    var ta = el('textarea', {
      class: 'summary-text',
      oninput: function (e) {
        state.summary.text = e.target.value;
        state.summary.reviewed = false;
        renderSummaryActions();
      }
    });
    ta.value = state.summary.text;
    ta.placeholder = 'Generate a draft, then edit it here. Nothing is final until a human marks it reviewed.';
    body.appendChild(ta);

    body.appendChild(el('div', { class: 'summary-actions', id: 'summary-actions' }));
    renderSummaryActions();

    if (state.llmMode === 'live') {
      var keyInput = el('input', {
        type: 'password',
        placeholder: 'OpenAI API key \u2014 held in memory only, local demo use',
        oninput: function (e) { state.apiKey = e.target.value; }
      });
      keyInput.value = state.apiKey;
      body.appendChild(el('div', { class: 'api-key-row' }, [keyInput]));
    }

    if (state.summary.error) {
      body.appendChild(el('div', { class: 'llm-error', text: state.summary.error }));
    }

    body.appendChild(el('div', { class: 'disclaimer' }, [
      el('strong', { text: 'Demo \u2014 preliminary screening only. ' }),
      document.createTextNode('Attorney review required. Rules are illustrative; verify current statute. Draft summaries are AI-generated from structured intake data and must be edited and approved by a human before use.')
    ]));

    if (state.lastAssessment) {
      body.appendChild(el('div', {
        class: 'audit-line',
        text: 'Summary state ' + nowStamp() + ' \u00b7 rules v' + state.lastAssessment.audit.ruleVersion + ' \u00b7 inputs #' + state.lastAssessment.audit.inputsHash + ' \u00b7 llm: ' + state.llmMode
      }));
    }
  }

  function renderSummaryActions() {
    var wrap = $('#summary-actions');
    if (!wrap) return;
    wrap.innerHTML = '';

    wrap.appendChild(el('button', {
      class: 'btn small',
      text: state.summary.generating ? 'Generating\u2026' : (state.summary.text ? 'Regenerate draft' : 'Generate draft'),
      onclick: generateSummary
    }));

    if (state.summary.text && !state.summary.reviewed) {
      wrap.appendChild(el('button', {
        class: 'btn secondary small',
        text: 'Mark reviewed & save',
        onclick: function () {
          state.summary.reviewed = true;
          state.summary.reviewedAt = nowStamp();
          renderSummaryActions();
        }
      }));
      wrap.appendChild(el('span', { class: 'review-note', text: 'Draft \u2014 not yet reviewed by a human.' }));
    }

    if (state.summary.reviewed) {
      wrap.appendChild(el('span', { class: 'review-badge', text: '\u2713 Reviewed ' + state.summary.reviewedAt }));
    }
  }

  function generateSummary() {
    if (state.summary.generating) return;
    var a = Rules.evaluateCase(state.caseData, state.config);
    a.procedural = Rules.resolveTrack(state.caseData, state.config);
    state.lastAssessment = a;
    state.summary.generating = true;
    state.summary.error = null;
    renderSummaryActions();

    LLM.generateSummary(state.caseData, a, { mode: state.llmMode, apiKey: state.apiKey })
      .then(function (text) {
        state.summary.text = text;
        state.summary.reviewed = false;
        state.summary.generating = false;
        renderSummaryPanel();
      })
      .catch(function (err) {
        state.summary.generating = false;
        state.summary.error = err.message;
        renderSummaryPanel();
      });
  }

  /* ------------------------------ boot ------------------------------------ */

  document.addEventListener('DOMContentLoaded', function () {
    $('#rules-toggle').addEventListener('click', function () {
      state.rulesOpen = !state.rulesOpen;
      renderRulesPanel();
    });

    $('#mode-checkbox').addEventListener('change', function (e) {
      state.llmMode = e.target.checked ? 'live' : 'mock';
      state.summary.error = null;
      renderSummaryPanel();
    });

    loadCase('case-strong');
  });

})();
