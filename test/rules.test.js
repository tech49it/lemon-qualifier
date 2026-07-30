/* Plain Node test — no framework. Run: node test/rules.test.js */
require('../js/rules.js');
require('../js/sampleCases.js');

var R = globalThis.LemonRules;
var S = globalThis.LemonSamples;
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

console.log(failures === 0 ? '\nAll checks passed.' : '\n' + failures + ' failure(s).');
process.exit(failures === 0 ? 0 : 1);
