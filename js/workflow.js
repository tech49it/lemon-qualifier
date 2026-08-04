/* =========================================================================
 * workflow.js — governed-intake logic: case lifecycle, approval guard,
 * append-only audit log, reviewer roster, lead-source/UTM, booking slots.
 *
 * Pure logic only. No DOM, no network. Runs identically in Node for testing,
 * same as rules.js / llm.js. All names, timestamps, and data are FICTIONAL.
 * ========================================================================= */

(function (global) {
  'use strict';

  /* --------------------------- case lifecycle ---------------------------- */

  var STATES = {
    DRAFT: 'DRAFT',
    PENDING_REVIEW: 'PENDING_REVIEW',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
    NEEDS_INFO: 'NEEDS_INFO'
  };

  var STATE_LABEL = {
    DRAFT: 'Draft',
    PENDING_REVIEW: 'Pending review',
    APPROVED: 'Approved',
    REJECTED: 'Rejected',
    NEEDS_INFO: 'Needs more info'
  };

  /* Allowed transitions. Anything not listed is refused (returns null). */
  var TRANSITIONS = {
    DRAFT:          { submit: 'PENDING_REVIEW' },
    PENDING_REVIEW: { approve: 'APPROVED', reject: 'REJECTED', needs_info: 'NEEDS_INFO', revoke: 'DRAFT' },
    NEEDS_INFO:     { resubmit: 'PENDING_REVIEW', revoke: 'DRAFT' },
    APPROVED:       { revoke: 'DRAFT' },          // editing inputs after approval revokes it
    REJECTED:       { revoke: 'DRAFT', resubmit: 'PENDING_REVIEW' }
  };

  /**
   * nextState(current, action) -> next state string, or null if not allowed.
   * Pure; the single source of truth for what may follow what.
   */
  function nextState(current, action) {
    var row = TRANSITIONS[current];
    if (!row) return null;
    return row[action] || null;
  }

  /* --------------------------- approval guard ---------------------------- */

  /** canBook(caseState) — booking is only ever available on APPROVED. */
  function canBook(caseState) {
    return caseState === STATES.APPROVED;
  }

  /**
   * bookConsultation(caseState, slot) -> { slot, confirmedAt }
   * The guard the brief requires "in logic, not just UI": refuses unless the
   * case is APPROVED. Throws otherwise so a mis-wired caller cannot book.
   */
  function bookConsultation(caseState, slot) {
    if (!canBook(caseState)) {
      throw new Error('Booking refused: case is ' + (caseState || 'undefined') + ', not APPROVED.');
    }
    if (!slot) {
      throw new Error('Booking refused: no slot selected.');
    }
    return { slot: slot, confirmedAt: nowISO() };
  }

  /* --------------------------- reviewer roster --------------------------- */
  /* Fictional staff. No real people, no firm branding. */

  var REVIEWERS = [
    'M. Reyes — Intake Supervisor',
    'J. Tran — Intake Coordinator',
    'D. Okonkwo — Case Manager'
  ];

  /* --------------------------- lead source / UTM ------------------------- */

  var LEAD_SOURCES = [
    ['google', 'Google Ads'],
    ['meta', 'Meta'],
    ['tiktok', 'TikTok'],
    ['organic', 'Organic search'],
    ['phone', 'Phone'],
    ['referral', 'Referral']
  ];

  var PAID_SOURCES = { google: true, meta: true, tiktok: true };

  /** utmFor(source) -> fictional UTM query string for paid sources, else ''. */
  function utmFor(source) {
    switch (source) {
      case 'google': return 'utm_source=google&utm_medium=cpc&utm_campaign=lemon-ca-search-demo';
      case 'meta':   return 'utm_source=meta&utm_medium=paid_social&utm_campaign=lemon-ca-fb-demo';
      case 'tiktok': return 'utm_source=tiktok&utm_medium=paid_social&utm_campaign=lemon-ca-tt-demo';
      default:       return '';
    }
  }

  function isPaidSource(source) { return !!PAID_SOURCES[source]; }

  function leadSourceLabel(source) {
    for (var i = 0; i < LEAD_SOURCES.length; i++) {
      if (LEAD_SOURCES[i][0] === source) return LEAD_SOURCES[i][1];
    }
    return source || '—';
  }

  /* --------------------------- booking slots ----------------------------- */
  /* Fictional availability: two slots on each of the next two business days,
   * always in the future relative to "now". Simulated — never transmitted. */

  var DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  function availableSlots(fromDate) {
    var base = fromDate ? new Date(fromDate.getTime()) : new Date();
    var slots = [];
    var times = ['10:15 AM', '2:30 PM'];
    var added = 0;
    var d = new Date(base.getTime());
    while (added < 2) {                 // next two business days
      d.setDate(d.getDate() + 1);
      var dow = d.getDay();
      if (dow === 0 || dow === 6) continue; // skip weekends
      for (var t = 0; t < times.length; t++) {
        slots.push(DAY_ABBR[dow] + ' ' + monthDay(d) + ', ' + times[t] + ' PT');
      }
      added++;
    }
    return slots;
  }

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function monthDay(d) { return MONTHS[d.getMonth()] + ' ' + d.getDate(); }

  /* --------------------------- audit log --------------------------------- */
  /* Append-only, in-memory. Seeded with fictional historical entries so the
   * panel never reads empty. ISO-8601 timestamps; live events sort after seeds. */

  function nowISO() { return new Date().toISOString(); }

  var SEED_ENTRIES = [
    ['2026-08-01T15:02:11Z', 'system',        'intake submitted',      'Case INT-2041 · source: Google Ads (utm_source=google&utm_medium=cpc&utm_campaign=lemon-ca-search-demo)'],
    ['2026-08-01T15:02:12Z', 'system',        'AI draft generated',    'Case INT-2041 · mode: mock'],
    ['2026-08-01T15:19:44Z', 'M. Reyes — Intake Supervisor', 'rule edited', 'Cumulative days out of service: 30 → 25'],
    ['2026-08-01T15:24:03Z', 'M. Reyes — Intake Supervisor', 'review: approved', 'Case INT-2041 · draft edited before approval'],
    ['2026-08-01T15:24:04Z', 'system',        'booking offered',       'Case INT-2041 · 4 slots presented'],
    ['2026-08-02T17:41:29Z', 'system',        'intake submitted',      'Case INT-2042 · source: Referral'],
    ['2026-08-02T17:41:30Z', 'system',        'AI draft generated',    'Case INT-2042 · mode: mock'],
    ['2026-08-02T17:55:10Z', 'J. Tran — Intake Coordinator', 'review: needs more info', 'Case INT-2042 · requested warranty booklet + in-service date'],
    ['2026-08-03T14:08:52Z', 'system',        'intake submitted',      'Case INT-2043 · source: Meta (utm_source=meta&utm_medium=paid_social&utm_campaign=lemon-ca-fb-demo)'],
    ['2026-08-03T14:12:37Z', 'D. Okonkwo — Case Manager', 'review: rejected', 'Case INT-2043 · no active manufacturer warranty']
  ];

  function createAuditLog() {
    var entries = [];

    function append(actor, action, detail) {
      var e = { ts: nowISO(), actor: actor || 'system', action: action, detail: detail || '' };
      entries.push(e);
      return e;
    }

    function seed() {
      SEED_ENTRIES.forEach(function (row) {
        entries.push({ ts: row[0], actor: row[1], action: row[2], detail: row[3] });
      });
    }

    /* reverse-chronological (newest first) */
    function list() {
      return entries.slice().sort(function (a, b) {
        var ta = new Date(a.ts).getTime(), tb = new Date(b.ts).getTime();
        return tb - ta;
      });
    }

    return { entries: entries, append: append, seed: seed, list: list };
  }

  global.LemonWorkflow = {
    STATES: STATES,
    STATE_LABEL: STATE_LABEL,
    nextState: nextState,
    canBook: canBook,
    bookConsultation: bookConsultation,
    REVIEWERS: REVIEWERS,
    LEAD_SOURCES: LEAD_SOURCES,
    PAID_SOURCES: PAID_SOURCES,
    isPaidSource: isPaidSource,
    utmFor: utmFor,
    leadSourceLabel: leadSourceLabel,
    availableSlots: availableSlots,
    createAuditLog: createAuditLog,
    nowISO: nowISO
  };

})(typeof window !== 'undefined' ? window : globalThis);
