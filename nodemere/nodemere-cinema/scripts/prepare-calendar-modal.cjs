// Preserve native styles verbatim; scope a desktop-only derivative to this film scene.
const fs = require('fs');
const path = require('path');
const postcss = require('postcss');
const root = path.resolve(__dirname, '..');
const source = path.resolve(root, '../src/sonar/components');
const target = path.join(root, 'src/product/calendar-modal');
fs.mkdirSync(target, {recursive:true});
let output = '/* Generated from Calendar DropInsModal styles. Fixed desktop viewport; film scope only. */\n';
for (const name of ['dropIns.css', 'dropInsLayered.css', 'dropInPreview.css']) {
 const css = fs.readFileSync(path.join(source,name),'utf8');
 fs.writeFileSync(path.join(target,name),css);
 const sheet = postcss.parse(css);
 sheet.walkAtRules('media', rule => rule.remove());
 sheet.walkRules(rule => {
   if (rule.parent.type==='atrule' && rule.parent.name.endsWith('keyframes')) return;
   rule.selectors = rule.selectors.map(selector => `.calendar-dropins-film ${selector}`);
 });
 output += sheet.toString()+'\n';
}
fs.writeFileSync(path.join(target,'scoped.css'),output);
// The calendar template uses the native FcGoogle asset; retain its exact paths.
const icons = fs.readFileSync(path.resolve(root,'../node_modules/react-icons/fc/index.js'),'utf8');
const json = icons.match(/module\.exports\.FcGoogle = function FcGoogle \(props\) \{\s+return GenIcon\((.*?)\)\(props\);/s)[1];
fs.writeFileSync(path.join(target,'google-icon.json'),JSON.stringify(JSON.parse(json),null,2));
console.log('Prepared native Calendar modal CSS and Google icon.');
