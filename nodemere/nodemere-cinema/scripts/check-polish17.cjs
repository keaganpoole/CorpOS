const fs = require('fs');
const vm = require('vm');
const ts = require('typescript');
const assert = require('assert/strict');
function load(source, extras={}) {
  const box = {exports:{}, ...extras};
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,box);
  return box.exports;
}
const {continuousTrack} = load(fs.readFileSync('src/cinematicMotion.ts','utf8'));
const source=fs.readFileSync('src/RevisionFour.tsx','utf8');
const cameraSource=source.slice(source.indexOf('export const catalogCamera'),source.indexOf('const Catalog ='));
const {catalogCamera}=load(cameraSource,{continuousTrack});
let sampled=0;
for(let frame=0;frame<=1500;frame++) {
  const t=frame/60, c=catalogCamera(t);
  assert(Object.values(c).every(Number.isFinite));
  assert(c.scale>0 && c.scale<=2.050001);
  if(t>=6.08 && t<=15.08) assert(Math.abs(c.scale-2.05)<1e-9);
  sampled++;
}
const joins=[];
for(const t of [9.08,12.08,15.08,17.8]) {
  const h=0.00001,a=catalogCamera(t-h),b=catalogCamera(t),c=catalogCamera(t+h);
  for(const key of Object.keys(b)) {
    const before=(b[key]-a[key])/h,after=(c[key]-b[key])/h;
    assert(Math.abs(before-after)<.1,`Velocity discontinuity at ${t}: ${key}`);
  }
  joins.push(t);
}
const report={sampledFrames:sampled,collectionPassSeconds:3,passCount:3,constantCloseZoom:2.05,continuousVelocityAt:joins,videoExported:false};
fs.writeFileSync('review/polish17-motion-checks.json',JSON.stringify(report,null,2));
console.log(report);
