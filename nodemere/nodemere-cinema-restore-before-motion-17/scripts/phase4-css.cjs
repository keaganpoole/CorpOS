const fs=require('fs');
const path=require('path');
const postcss=require('../../node_modules/postcss');
const tailwind=require('../../node_modules/tailwindcss');
const root=path.resolve(__dirname,'../src/product/phase4');
async function main(){
 const result=await postcss([tailwind({content:[root+'/**/*.{js,jsx}',path.resolve(__dirname,'../src/*Scene.tsx')],important:'.phase4-product',corePlugins:{preflight:false},theme:{extend:{}},plugins:[]})]).process('@tailwind utilities;',{from:undefined});
 fs.writeFileSync(path.join(root,'tailwind.css'),result.css);
 const source=['crm-entrance.native.css','scenarios.native.css','nest.native.css'].map(f=>fs.readFileSync(path.join(root,f),'utf8')).join('\n');
 const ast=postcss.parse(source);const names=new Map();
 ast.walkAtRules(/keyframes$/i,a=>{names.set(a.params,'p4-'+a.params);a.params='p4-'+a.params;});
 ast.walkDecls(d=>{if(d.prop==='animation'||d.prop==='animation-name')for(const [name,prefixed]of names)d.value=d.value.replace(new RegExp('(?<![\\w-])'+name+'(?![\\w-])','g'),prefixed);});
 const valueParser=require('../../node_modules/postcss-value-parser');
 ast.walkRules(r=>{if(r.parent.type==='atrule'&&/keyframes$/i.test(r.parent.name))return;
  const anim=r.nodes.find(n=>n.prop==='animation');const delay=r.nodes.find(n=>n.prop==='animation-delay');
  if(anim&&anim.value!=='none'){
   const groups=[];let current=[];for(const node of valueParser(anim.value).nodes){if(node.type==='div'&&node.value===','){groups.push(current);current=[];}else current.push(node);}groups.push(current);
   const delays=delay?postcss.list.comma(delay.value):groups.map(nodes=>nodes.filter(n=>n.type==='word'&&/^[-.\d]+m?s$/.test(n.value))[1]?.value||'0s');
   const origins=groups.map(nodes=>nodes.some(n=>n.value?.includes('configured'))?'--p4-configured-origin':'--p4-origin');
   const value=delays.map((d,i)=>`calc(${d} + var(${origins[i]||'--p4-origin'}, 0s) - var(--p4-time, 0s))`).join(',');
   if(delay)delay.value=value;else r.append({prop:'animation-delay',value});
   r.append({prop:'animation-play-state',value:'paused'});
  }else if(delay)delay.value=postcss.list.comma(delay.value).map(d=>`calc(${d} + var(--p4-origin, 0s) - var(--p4-time, 0s))`).join(',');
  r.selectors=r.selectors.map(s=>s.trim()===':root'?'.phase4-product':'.phase4-product '+s.replaceAll('.scenarios-container:not(.scenarios-container--demo)','').trim());
 });
 fs.writeFileSync(path.join(root,'native.css'),ast.toString());
 console.log('Phase 4 native styles scoped; '+names.size+' native keyframes preserved.');
}main();
