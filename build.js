#!/usr/bin/env node
/* build.js — zero-dependency static build.
 *
 * Copies the public landing page, robots.txt, and shared css/js/docs into
 * dist/ as-is, then stamps the ONE shared demo template (demo/app/index.html)
 * into a separate directory per firm slug. The qualifier engine and CSS
 * exist in exactly one place (css/, js/) and are referenced by absolute
 * path from every demo copy, so nothing but a thin markup shell is
 * duplicated. demo/app/ itself is never copied into dist/ — only the named
 * per-firm slugs are, so there is no ungated fourth path serving the same
 * content.
 */

var fs = require('fs');
var path = require('path');

var ROOT = __dirname;
var DIST = path.join(ROOT, 'dist');
var DEMO_SLUGS = ['lemonpros', 'nita', 'alpha'];

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function copyDir(srcDir, destDir) {
  for (var entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    var src = path.join(srcDir, entry.name);
    var dest = path.join(destDir, entry.name);
    if (entry.isDirectory()) copyDir(src, dest);
    else copyFile(src, dest);
  }
}

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });

copyFile(path.join(ROOT, 'index.html'), path.join(DIST, 'index.html'));
copyFile(path.join(ROOT, 'robots.txt'), path.join(DIST, 'robots.txt'));
copyDir(path.join(ROOT, 'css'), path.join(DIST, 'css'));
copyDir(path.join(ROOT, 'js'), path.join(DIST, 'js'));
copyDir(path.join(ROOT, 'docs'), path.join(DIST, 'docs'));

var demoTemplate = fs.readFileSync(path.join(ROOT, 'demo', 'app', 'index.html'), 'utf8');
DEMO_SLUGS.forEach(function (slug) {
  var dest = path.join(DIST, 'demo', slug, 'index.html');
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, demoTemplate);
});

console.log('Built landing page + ' + DEMO_SLUGS.length + ' demo slug(s) into dist/');
