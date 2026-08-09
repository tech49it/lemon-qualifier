/* =========================================================================
 * engine.test.js — pure-engine assertions. No framework, no dependencies.
 * Run:  node test/engine.test.js
 *
 * Loads js/engine.js + the data files DIRECTLY (rules.js, sampleCases.js,
 * llm.js, closedCases.js) — there is no eval/regex extraction from index.html.
 * The delivered v2 engine_test.js was an eval harness against a single-file
 * app; this replaces it and runs against the decomposed engine.
 *
 * Covers: the 21 delivered v2 assertions adapted to the reconciled sample
 * cases and v1.4 verdict vocabulary, plus determinism, daysOutOfService edge
 * cases, the value screen, the roster, and a permanent statute-citation guard.
 * ========================================================================= */

require('../js/rules.js');
require('../js/engine.js');
require('../js/sampleCases.js');
require('../js/llm.js');
require('../js/closedCases.js');

var fs = require('fs');
var path = require('path');
var R = globalThis.LemonRules;
var S = globalThis.LemonSamples;
var L = globalThis.LemonLLM;
var CFG = R.RULES_CONFIG;

var failures = 0, count = 0;
function T(name, cond) {
  count++;
  console.log((cond ? 'ok:   ' : 'FAIL: ') + name);
  if (!cond) failures++;
}

var byId = {};
S.SAMPLE_CASES.forEach(function (c) { byId[c.id] = c; });
var rivera = byId['case-strong'];      // Chevrolet Silverado — safety, cross-dealer overlap
var okafor = byId['case-borderline'];  // Hyundai Tucson — borderline
var petro  = byId['case-notqualified'];// used BMW — Rodriguez / warranty gate

/* ===================== days out of service (range merge) ================ */
/* Delivered: A naive 36 / overlap 3 / total 33 — adapted to Rivera's
 * reconciled dates (naive 39 − 5 overlapping = 34 merged). */
var riv = R.daysOutOfService(rivera.repairs);
T('Rivera naive days = 39', riv.naive === 39);
T('Rivera overlap = 5', riv.overlap === 5);
T('Rivera merged total = 34', riv.total === 34);

var okf = R.daysOutOfService(okafor.repairs);
T('Okafor days = 21 (no overlap)', okf.total === 21 && okf.overlap === 0);

/* ===================== verdicts for all three cases ===================== */
/* Delivered A/B/C verdicts, in v1.4 vocabulary. */
var eR = R.evaluateCase(rivera, CFG);
T('Rivera verdict = STRONG', eR.verdict === 'STRONG');
T('Rivera attempts = 3 (CND visit counted)', eR.computed.attempts === 3);

var eB = R.evaluateCase(okafor, CFG);
T('Okafor verdict = PROMISING', eB.verdict === 'PROMISING');

var eP = R.evaluateCase(petro, CFG);
T('Petrosyan verdict = NOT_QUALIFIED (warranty gate)', eP.verdict === 'NOT_QUALIFIED');

/* ===================== document flags ================================== */
/* Delivered: CND / DATE / OVERLAP flag detection. */
var fR = R.docFlags(rivera);
T('Rivera has CND flag', fR.some(function (f) { return f.code === 'CND'; }));
T('Rivera has DATE conflict flag', fR.some(function (f) { return f.code === 'DATE'; }));
T('Rivera has OVERLAP flag', fR.some(function (f) { return f.code === 'OVERLAP'; }));
T('Okafor has a DATE conflict flag (invoice ≠ date-out)', R.docFlags(okafor).some(function (f) { return f.code === 'DATE'; }));
T('Petrosyan has zero extraction flags', R.docFlags(petro).length === 0);

/* ===================== swing factor / borderline ======================== */
/* Delivered "B swing names one more attempt / 9 more days" — Okafor's
 * decisive unknown in the v1.4 model is the safety classification (attempts
 * already meet the 2-attempt safety guideline, safety marked unsure). */
var sfB = L.swingFactor(okafor, eB, CFG);
T('Okafor swing factor is surfaced', sfB !== null);
T('Okafor swing = safety classification', sfB && sfB.key === 'safety');

/* ===================== Rodriguez / used-vehicle screen ================== */
/* Delivered C: used + warranty question controls. */
var usP = R.screenUsedVehicle(petro, CFG);
T('Petrosyan used-vehicle screen flags critical', usP.flagged === true && usP.severity === 'critical');
T('Petrosyan screen names Rodriguez', /Rodriguez/.test(usP.message || ''));

var petroUnsure = JSON.parse(JSON.stringify(petro));
petroUnsure.warranty.warrantyIssuedAtSale = 'unsure';
T('used + unsure warranty -> warning (confirm at sale)',
  R.screenUsedVehicle(petroUnsure, CFG).severity === 'warning');

var petroYes = JSON.parse(JSON.stringify(petro));
petroYes.warranty.warrantyIssuedAtSale = 'yes';
T('used + warranty=yes -> not a critical decline',
  R.screenUsedVehicle(petroYes, CFG).severity !== 'critical');

/* ===================== rules honored (config drives outcome) ============ */
/* Delivered "B flips when generalAttempts=3": lowering the same-defect
 * threshold to 3 makes Okafor's same-defect criterion MET (3 >= 3). Okafor
 * stays PROMISING rather than STRONG because warranty is unconfirmed — the
 * v1.4 gate, honored. */
var cfg3 = JSON.parse(JSON.stringify(CFG));
cfg3.criteria.sameDefectAttempts.threshold = 3;
var eB3 = R.evaluateCase(okafor, cfg3);
T('Okafor same-defect criterion flips to MET at threshold 3',
  eB3.criteria.filter(function (c) { return c.id === 'sameDefectAttempts'; })[0].met === true);

/* ===================== deadline math: earlier-of ======================= */
/* Delivered A fast-track: rule 1 (warranty+1yr=2029) controls over
 * rule 2 (delivery+6yr=2031). */
var fastCfg = JSON.parse(JSON.stringify(CFG));
fastCfg.manufacturerRegistry = { 'chevrolet': { optedIn: true, effectiveFrom: '2025-01-01' } };
var trackR = R.resolveTrack(rivera, fastCfg);
var solR = R.computeDeadlines(rivera, trackR, fastCfg).filter(function (d) { return d.id === 'sol'; })[0];
T('Rivera fast-track SOL = 2029-04-14 (warranty+1yr controls)', solR.date === '2029-04-14');
T('Rivera SOL basis names the controlling rule', /after warranty expiry/.test(solR.basis));

/* ===================== roster routing =================================== */
/* Empty roster -> undetermined; adding a manufacturer -> fast track. */
S.SAMPLE_CASES.forEach(function (c) {
  T('empty roster -> undetermined (' + c.id + ')', R.resolveTrack(c, CFG).status === 'unknown');
});
T('roster add -> fast_track for opted-in make', trackR.status === 'fast_track');

/* ===================== determinism ===================================== */
/* Same inputs twice -> deep-equal outputs. evaluateCase stamps a wall-clock
 * audit.timestamp, so compare everything except that volatile field; the
 * input hash itself must be identical. */
function stripTs(a) { var o = JSON.parse(JSON.stringify(a)); if (o.audit) delete o.audit.timestamp; return o; }
var d1 = R.evaluateCase(rivera, CFG), d2 = R.evaluateCase(rivera, CFG);
T('evaluateCase is deterministic (deep-equal ex-timestamp)',
  JSON.stringify(stripTs(d1)) === JSON.stringify(stripTs(d2)));
T('evaluateCase input hash is deterministic', d1.audit.inputsHash === d2.audit.inputsHash);

/* ===================== daysOutOfService edge cases ===================== */
T('daysOutOfService: zero visits -> {0,0,0}', (function () {
  var z = R.daysOutOfService([]);
  return z.total === 0 && z.naive === 0 && z.overlap === 0;
})());
T('daysOutOfService: fully-nested ranges merge to the outer range', (function () {
  var n = R.daysOutOfService([
    { dateIn: '2025-01-01', dateOut: '2025-01-31' }, // 30
    { dateIn: '2025-01-10', dateOut: '2025-01-20' }  // 10, fully inside
  ]);
  return n.total === 30 && n.naive === 40 && n.overlap === 10;
})());

/* ===================== value screen ==================================== */
var vR = R.estimateValue(rivera, eR, CFG);
var expOffset = Math.round(58900 * ((6480 - 12) / 120000));
T('value: Rivera tier = FULL_BUYBACK_CANDIDATE', vR.tier === 'FULL_BUYBACK_CANDIDATE');
T('value: Rivera exposure = documented figure ($' + (58900 - expOffset).toLocaleString() + ')',
  vR.exposure.net === 58900 - expOffset && vR.exposure.offsetAmount === expOffset);

var noPrice = JSON.parse(JSON.stringify(rivera));
noPrice.vehicle.purchasePrice = '';
var vNoPrice = R.estimateValue(noPrice, R.evaluateCase(noPrice, CFG), CFG);
T('value: missing price demotes tier to ATTORNEY_REVIEW, exposure null',
  vNoPrice.tier === 'ATTORNEY_REVIEW' && vNoPrice.exposure.net === null);

var floorCfg = JSON.parse(JSON.stringify(CFG));
floorCfg.valueScreen.exposureReviewFloor = 999999;
T('value: floor above exposure demotes tier to ATTORNEY_REVIEW',
  R.estimateValue(rivera, R.evaluateCase(rivera, floorCfg), floorCfg).tier === 'ATTORNEY_REVIEW');

T('value: penalty screen never states a dollar amount',
  JSON.stringify(vR.civilPenalty).indexOf('$') === -1);

/* ===================== statute-citation regression (permanent) ========= */
/* Repo-wide: § 1793.22 present, § 1793.2(d) present, and NO occurrence of a
 * bare 793.2 that is not preceded by a 1. Guards the citation forever. */
var ROOT = path.join(__dirname, '..');
var scan = [
  'index.html', 'README.md', 'CLAUDE.md', 'DEPLOY.md',
  'js/rules.js', 'js/engine.js', 'js/sampleCases.js', 'js/closedCases.js', 'js/llm.js', 'js/workflow.js', 'js/app.js'
].map(function (f) { return path.join(ROOT, f); }).filter(fs.existsSync);

var badCite = [];
scan.forEach(function (fp) {
  var txt = fs.readFileSync(fp, 'utf8');
  if (/(?<!1)793\.2/.test(txt)) badCite.push(path.basename(fp));
});
T('no bare "793.2" citation anywhere (must be 1793.2)', badCite.length === 0);

var idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
var rme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
T('§ 1793.22 present in index.html', /1793\.22/.test(idx));
T('§ 1793.22 present in README.md', /1793\.22/.test(rme));
T('§ 1793.2(d) present in index.html', /1793\.2\(d\)/.test(idx));

/* ======================================================================= */
console.log('\n' + count + ' assertions, ' + (failures === 0 ? 'all passed.' : failures + ' FAILED.'));
process.exit(failures === 0 ? 0 : 1);
