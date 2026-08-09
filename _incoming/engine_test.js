// Extract pure engine functions and run assertions against the three sample cases.
const fs = require('fs');
const html0 = fs.readFileSync(require('path').join(__dirname,'index.html'),'utf8');
const src = html0.match(/<script>([\s\S]*)<\/script>/)[1];

// Stub the DOM-facing pieces so the module loads; we only exercise pure functions.
global.document = { getElementById: () => ({ addEventListener(){}, innerHTML:'', textContent:'', value:'', classList:{add(){},remove(){}}, setAttribute(){}, style:{} }), querySelectorAll: () => [], querySelector: () => null };
global.matchMedia = () => ({ matches: true });
global.navigator = {};
// Cut the wiring/boot section so nothing renders.
const cut = src.split('/* boot */')[0].split('/* ============================================================\n   WIRING')[0];
eval(cut.replace("'use strict';",'').replace(/^const /gm,'var '));


const T = (name, cond) => { if(!cond){ console.error('FAIL: '+name); process.exitCode = 1; } else console.log('ok: '+name); };

// Case A: overlap dedup + presumption
let dos = daysOutOfService(CASES.A.visits);
T('A naive days = 36', dos.naive === 36);
T('A overlap = 3', dos.overlap === 3);
T('A merged total = 33', dos.total === 33);
let ev = evaluateCase(CASES.A, state.rules);
T('A verdict = PRESUMPTION SUPPORTED', ev.verdict === 'PRESUMPTION SUPPORTED');
T('A attempts = 3 (CND counted)', ev.attempts === 3);
T('A has CND flag', docFlags(CASES.A).some(f=>f.code==='CND'));
T('A has DATE conflict flag', docFlags(CASES.A).some(f=>f.code==='DATE'));
T('A has OVERLAP flag', docFlags(CASES.A).some(f=>f.code==='OVERLAP'));

// Case B: borderline — 3 attempts (<4), 22 days (<=30)
dos = daysOutOfService(CASES.B.visits);
T('B days = 22', dos.total === 22);
ev = evaluateCase(CASES.B, state.rules);
T('B verdict = BELOW GUIDELINES — REVIEW', ev.verdict === 'BELOW GUIDELINES — REVIEW');
T('B swing names one more attempt', /One more documented attempt/.test(ev.swing));
T('B swing names 9 more days', /9 more out-of-service days/.test(ev.swing));

// Case C: used + unknown warranty → Rodriguez controls
ev = evaluateCase(CASES.C, state.rules);
T('C verdict = ATTORNEY DETERMINATION', ev.verdict === 'ATTORNEY DETERMINATION');
T('C Rodriguez criterion present', ev.criteria.some(c=>/Rodriguez/.test(c.label)));
T('C open item: confirm warranty at sale', ev.openItems.some(o=>/manufacturer warranty issued at the used sale/.test(o)));

// Case C with warranty confirmed → merits screen applies; outside window, meritless on attempts(2<4)/days
CASES.C.warrantyAtSale = 'yes';
ev = evaluateCase(CASES.C, state.rules);
T('C(warranty=yes) not attorney-determination', ev.verdict !== 'ATTORNEY DETERMINATION');
CASES.C.warrantyAtSale = 'unknown';

// Rule edit changes outcome: drop general attempts to 3 → B should flip on attempts... but B is non-safety with 3 attempts, in window
state.rules.generalAttempts.v = 3;
ev = evaluateCase(CASES.B, state.rules);
T('B flips to PRESUMPTION when generalAttempts=3', ev.verdict === 'PRESUMPTION SUPPORTED');
state.rules.generalAttempts.v = 4;

// Deadline math: earlier-of logic
const dl = deadlineMath(CASES.A, state.rules);
T('A fast-track: rule 1 (warranty+1yr=2028) vs rule 2 (delivery+6yr=2030) → rule 1 controls', dl.ctrl === 1);

// Statute cite check across whole file
const html = html0;
T('no wrong § 793.22 cite anywhere', !/[^1]793\.22|(?<!1)§ 793/.test(html.replace(/1793\.22/g,'')) );
T('§ 1793.22 present', /1793\.22/.test(html));
T('§ 1793.2\(d\) present', /1793\.2\(d\)/.test(html));
