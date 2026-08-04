/* Plain Node test — no framework. Run: node test/rules.test.js */
require('../js/rules.js');
require('../js/sampleCases.js');
require('../js/llm.js');

var R = globalThis.LemonRules;
var S = globalThis.LemonSamples;
var L = globalThis.LemonLLM;
var failures = 0;

function check(name, cond) {
  console.log((cond ? 'PASS  ' : 'FAIL  ') + name);
  if (!cond) failures++;
}

var expected = {
  'case-strong': 'STRONG',
  'case-borderline': 'PROMISING',
  'case-notqualified': 'NOT_QUALIFIED'
};

S.SAMPLE_CASES.forEach(function (c) {
  var a = R.evaluateCase(c, R.RULES_CONFIG);
  check(c.id + ' -> ' + expected[c.id], a.verdict === expected[c.id]);
});

/* determinism: same inputs, same hash */
var h1 = R.evaluateCase(S.SAMPLE_CASES[0], R.RULES_CONFIG).audit.inputsHash;
var h2 = R.evaluateCase(S.SAMPLE_CASES[0], R.RULES_CONFIG).audit.inputsHash;
check('input hash is deterministic', h1 === h2);

/* rules are honored: raising the same-defect threshold drops the strong case
   off that criterion (safety criterion still carries it) */
var cfg = JSON.parse(JSON.stringify(R.RULES_CONFIG));
cfg.criteria.sameDefectAttempts.threshold = 99;
var a2 = R.evaluateCase(S.SAMPLE_CASES[0], cfg);
check('config change is honored by engine',
  a2.criteria.filter(function (c) { return c.id === 'sameDefectAttempts'; })[0].met === false);

/* no-warranty gate holds regardless of thresholds */
var cfg2 = JSON.parse(JSON.stringify(R.RULES_CONFIG));
cfg2.criteria.daysOutOfService.threshold = 1;
var a3 = R.evaluateCase(S.SAMPLE_CASES[2], cfg2);
check('no-warranty gate holds', a3.verdict === 'NOT_QUALIFIED');


/* ===================== v1.1 — procedural track ===================== */

var byId = {};
S.SAMPLE_CASES.forEach(function (c) { byId[c.id] = c; });

/* Empty registry: every case is unknown */
S.SAMPLE_CASES.forEach(function (c) {
  var t = R.resolveTrack(c, R.RULES_CONFIG);
  check('empty registry -> unknown (' + c.id + ')', t.status === 'unknown');
});

/* Populated registry routes correctly */
var pcfg = JSON.parse(JSON.stringify(R.RULES_CONFIG));
pcfg.manufacturerRegistry = {
  'chevrolet': { optedIn: true, effectiveFrom: '2025-01-01' },
  'hyundai': { optedIn: false }
};
check('registry -> fast_track for opted-in make',
  R.resolveTrack(byId['case-strong'], pcfg).status === 'fast_track');
check('registry -> traditional for opted-out make',
  R.resolveTrack(byId['case-borderline'], pcfg).status === 'traditional');
check('registry -> unknown for unlisted make',
  R.resolveTrack(byId['case-notqualified'], pcfg).status === 'unknown');

/* SOL picks the EARLIER of the two candidates */
var strongTrack = R.resolveTrack(byId['case-strong'], pcfg);
var dl = R.computeDeadlines(byId['case-strong'], strongTrack, pcfg);
var sol = dl.filter(function (d) { return d.id === 'sol'; })[0];
check('SOL computed on fast track', sol.date === '2029-04-14');
check('SOL basis names the controlling rule', /after warranty expiry/.test(sol.basis));

/* Flip the cap so the other rule controls */
var capcfg = JSON.parse(JSON.stringify(pcfg));
capcfg.proceduralTracks.fastTrack.solCapYearsFromDelivery = 2;
var sol2 = R.computeDeadlines(byId['case-strong'], strongTrack, capcfg)
  .filter(function (d) { return d.id === 'sol'; })[0];
check('SOL switches to the earlier cap rule', sol2.date === '2027-04-14');
check('SOL basis reflects the cap', /cap from delivery/.test(sol2.basis));

/* Missing warranty expiration -> null date, no throw */
var noWarranty = JSON.parse(JSON.stringify(byId['case-strong']));
noWarranty.warranty.expirationDate = '';
var solMissing = R.computeDeadlines(noWarranty, strongTrack, pcfg)
  .filter(function (d) { return d.id === 'sol'; })[0];
check('missing warranty expiry -> null date, warning', solMissing.date === null && solMissing.severity === 'warning');

/* Traditional track does not compute a SOL */
var tradTrack = R.resolveTrack(byId['case-borderline'], pcfg);
var solTrad = R.computeDeadlines(byId['case-borderline'], tradTrack, pcfg)
  .filter(function (d) { return d.id === 'sol'; })[0];
check('traditional track defers SOL to attorney', solTrad.date === null);

/* Used-vehicle screening (post-Rodriguez) */
check('used + no warranty at sale -> critical flag',
  R.screenUsedVehicle(byId['case-notqualified'], R.RULES_CONFIG).flagged === true &&
  R.screenUsedVehicle(byId['case-notqualified'], R.RULES_CONFIG).severity === 'critical');
check('new vehicle -> screen does not apply',
  R.screenUsedVehicle(byId['case-strong'], R.RULES_CONFIG).flagged === false);
check('leased new vehicle -> screen does not apply',
  R.screenUsedVehicle(byId['case-borderline'], R.RULES_CONFIG).flagged === false);

var unsureUsed = JSON.parse(JSON.stringify(byId['case-notqualified']));
unsureUsed.warranty.warrantyIssuedAtSale = 'unsure';
check('used + unsure -> warning flag',
  R.screenUsedVehicle(unsureUsed, R.RULES_CONFIG).severity === 'warning');

/* ===================== v1.2 — repair timeline ===================== */

function timelineCase(repairs) {
  var c = JSON.parse(JSON.stringify(byId['case-strong']));
  c.repairs = repairs;
  return c;
}

check('timeline: zero visits does not throw', (function () {
  try {
    var t = R.buildTimeline(timelineCase([]), R.RULES_CONFIG);
    return t.hasVisits === false && t.segments.length === 0 && t.totals.attempts === 0;
  } catch (e) { return false; }
})());

check('timeline: one same-day visit renders as a bar', (function () {
  try {
    var t = R.buildTimeline(timelineCase([
      { dateIn: '2025-05-01', dateOut: '2025-05-01', samePrimaryDefect: true }
    ]), R.RULES_CONFIG);
    return t.segments.length === 1 && t.segments[0].kind === 'bar' && t.segments[0].days === 1;
  } catch (e) { return false; }
})());

check('timeline: visit missing dateOut renders as marker', (function () {
  try {
    var t = R.buildTimeline(timelineCase([
      { dateIn: '2025-05-01', dateOut: '', samePrimaryDefect: true }
    ]), R.RULES_CONFIG);
    return t.segments[0].kind === 'marker' && t.segments[0].incomplete === true;
  } catch (e) { return false; }
})());

check('timeline: out-of-order visits do not throw', (function () {
  try {
    var t = R.buildTimeline(timelineCase([
      { dateIn: '2025-11-01', dateOut: '2025-11-05', samePrimaryDefect: true },
      { dateIn: '2025-05-01', dateOut: '2025-05-03', samePrimaryDefect: true }
    ]), R.RULES_CONFIG);
    return t.segments.length === 2;
  } catch (e) { return false; }
})());

/* Timeline reports computeDerived's totals — it does not recompute them */
check('timeline totals match computeDerived', (function () {
  var c = byId['case-strong'];
  var d = R.computeDerived(c);
  var t = R.buildTimeline(c, R.RULES_CONFIG);
  return t.totals.attempts === d.attempts && t.totals.daysOut === d.daysOut;
})());


/* ===================== v1.2 — missing-document request ===================== */

var allCollected = [
  { id: 'a', label: 'Purchase contract', status: 'collected' },
  { id: 'b', label: 'Warranty booklet', status: 'collected' }
];
check('doc request: empty/disabled when all collected',
  L.documentRequestItems(allCollected).length === 0 &&
  L.buildMockDocumentRequest(allCollected, byId['case-strong'], 'email') === '');

var mixedList = [
  { id: 'a', label: 'Repair order — visit 1 (2025-09-02)', status: 'missing' },
  { id: 'b', label: 'Purchase contract', status: 'collected' },
  { id: 'c', label: 'Warranty booklet / coverage statement', status: 'requested' }
];
var emailDraft = L.buildMockDocumentRequest(mixedList, byId['case-strong'], 'email');
check('doc request: contains every missing/requested label',
  emailDraft.indexOf('Repair order — visit 1 (2025-09-02)') !== -1 &&
  emailDraft.indexOf('Warranty booklet / coverage statement') !== -1);
check('doc request: omits the collected label',
  emailDraft.indexOf('Purchase contract') === -1);
check('doc request: states no qualification outcome',
  !/qualif|strong candidate|not qualified|promising|legal advice/i.test(emailDraft));
var textDraft = L.buildMockDocumentRequest(mixedList, byId['case-strong'], 'text');
check('doc request: text draft is non-empty and under 320 chars',
  textDraft.length > 0 && textDraft.length <= 320);


/* ===================== v1.2.1 — summary swing factor / facts ============== */

var CFG = R.RULES_CONFIG;

/* Swing-factor selection */
check('swing: safety-unsure with sufficient attempts',
  L.swingFactor(byId['case-borderline'], R.evaluateCase(byId['case-borderline'], CFG), CFG).key === 'safety');

var cW = JSON.parse(JSON.stringify(byId['case-strong'])); cW.warranty.active = 'unsure';
check('swing: warranty unconfirmed',
  L.swingFactor(cW, R.evaluateCase(cW, CFG), CFG).key === 'warranty');

var cU = JSON.parse(JSON.stringify(byId['case-notqualified'])); cU.warranty.warrantyIssuedAtSale = 'unsure';
check('swing: used vehicle warranty-at-sale unconfirmed',
  L.swingFactor(cU, R.evaluateCase(cU, CFG), CFG).key === 'usedWarranty');

var nearCase = {
  contact: { name: 'Test' },
  vehicle: { year: '2025', make: 'Chevrolet', model: 'X', condition: 'new', purchaseType: 'purchase',
    purchaseDate: '2025-01-01', mileageAtPurchase: '10', currentMileage: '5000' },
  warranty: { active: 'yes', expirationDate: '2028-01-01', warrantyIssuedAtSale: 'yes' },
  problem: { description: 'x', safetyRelated: 'no' },
  repairs: [
    { dateIn: '2025-03-01', dateOut: '2025-03-01', samePrimaryDefect: true },
    { dateIn: '2025-04-01', dateOut: '2025-04-01', samePrimaryDefect: true },
    { dateIn: '2025-05-01', dateOut: '2025-05-01', samePrimaryDefect: true }
  ]
};
check('swing: near-threshold attempts',
  L.swingFactor(nearCase, R.evaluateCase(nearCase, CFG), CFG).key === 'nearAttempts');

check('swing: null when no decisive unknown',
  L.swingFactor(byId['case-notqualified'], R.evaluateCase(byId['case-notqualified'], CFG), CFG) === null);

/* Pluralization helper */
check('plur handles 0/1/2',
  L.plur(0, 'day') === 'days' && L.plur(1, 'day') === 'day' && L.plur(2, 'day') === 'days');

/* Summary for all three sample cases: screen result + caveat + no legal conclusion */
['case-strong', 'case-borderline', 'case-notqualified'].forEach(function (id) {
  var c = byId[id];
  var a = R.evaluateCase(c, CFG);
  a.procedural = R.resolveTrack(c, CFG);
  var s = L.buildMockSummary(c, a, CFG);
  check(id + ': summary states the screen result', s.indexOf(a.verdictLabel) !== -1);
  check(id + ': summary keeps the demo-threshold caveat',
    s.indexOf('demo thresholds pending attorney validation') !== -1);
  check(id + ': summary draws no legal conclusion',
    !/guarantee|will win|is a lemon|definitely qualif/i.test(s));
});

/* Both mock variants carry the same required facts (swing factor + every flag) */
var cB = byId['case-borderline'];
var aB = R.evaluateCase(cB, CFG); aB.procedural = R.resolveTrack(cB, CFG);
var sf = L.swingFactor(cB, aB, CFG);
var b1 = L.buildMockSummary(cB, aB, CFG);
var b2 = L.buildMockSummary(cB, aB, CFG);
var reqFacts = [aB.verdictLabel, 'demo thresholds pending attorney validation', sf.text].concat(aB.flags);
check('both mock variants carry swing factor and every flag',
  reqFacts.every(function (f) { return b1.indexOf(f) !== -1 && b2.indexOf(f) !== -1; }) && b1 !== b2);


/* v1.0 behaviour unchanged; version bumped */
check('rules version bumped to 1.2.1', R.RULES_CONFIG.version === '1.2.1-demo');


console.log(failures === 0 ? '\nAll checks passed.' : '\n' + failures + ' failure(s).');
process.exit(failures === 0 ? 0 : 1);
