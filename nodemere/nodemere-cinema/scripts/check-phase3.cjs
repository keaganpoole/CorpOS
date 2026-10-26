// Source scope, native fidelity, asset integrity and visible network bounds.
const fs=require('fs'),path=require('path'),vm=require('vm');
const {Easing}=require('remotion');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'src/NetworkScene.tsx'),'utf8');
const literal=name=>vm.runInNewContext('('+source.match(new RegExp('(?:export )?const '+name+' = (\\[[\\s\\S]*?\\n\\]);'))[1]+')');
const nodes=literal('NODES'),features=literal('FEATURES');
const ease=Easing.bezier(.22,1,.36,1),smooth=Easing.bezier(.55,0,.2,1);
const p=(t,a,b,e=ease)=>e(Math.max(0,Math.min(1,(t-a)/(b-a))));
function spline(t,times,v,s){if(t<=times[0])return v[0];if(t>=times.at(-1))return v.at(-1);const i=times.findIndex((k,j)=>j&&k>t)-1,d=times[i+1]-times[i],u=(t-times[i])/d;return (2*u**3-3*u*u+1)*v[i]+(u**3-2*u*u+u)*d*s[i]+(-2*u**3+3*u*u)*v[i+1]+(u**3-u*u)*d*s[i+1];}
let bad=[];
for(let frame=0;frame<23.6*60;frame++){
 const t=frame/60,scale=spline(t,[0,3.7,8,15,21.5,23.6],[640/340,1.37,1.16,1.04,1,1],[0,-.065,-.025,-.012,0,0]),spread=.62+.38*p(t,1,21.5,smooth);
 for(const [i,n] of nodes.entries())if(t>n.at+.85){
   const x=960+(n.x-960)*scale*spread,y=580+(n.y-580)*scale*spread,r=58*scale*spread*1.025;
   if(x-r<25||x+r>1895||y-r<175||y+r>1055)bad.push({frame,node:i,x,y,r});
 }
}
if(bad.length)throw Error(JSON.stringify(bad.slice(0,8)));
if(nodes.length!==14||features.length!==6)throw Error('Unexpected network structure');
for(const n of nodes)if(!fs.existsSync(path.join(root,`public/phase3/customer-${String(n.photo).padStart(2,'0')}.jpg`)))throw Error('Missing portrait');
if(source.includes('75+'))throw Error('Unverified language count');
const checks={network_customer_leaves:nodes.length,feature_beats:features.length,visible_node_bounds:'pass at every frame before deliberate endpoint close-up',native_css_unchanged:[]};
for(const file of ['dropInsPage.css','dropInPreview.css']){
 const product=path.join(root,'../src/sonar',file==='dropInsPage.css'?'pages':'components',file);
 if(!fs.readFileSync(product).equals(fs.readFileSync(path.join(root,'src/product',file))))throw Error(file+' differs from native source');
 checks.native_css_unchanged.push(file);
}
fs.writeFileSync(path.join(root,'review/phase3/source-checks.json'),JSON.stringify(checks,null,2));
fs.writeFileSync(path.join(root,'review/phase3/network-geometry.json'),JSON.stringify({nodes,features,trunks:literal('trunks')},null,2));
console.log(JSON.stringify(checks,null,2));
