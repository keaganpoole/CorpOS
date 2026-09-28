import { LOGO_PRESETS, LOGO_PATHS, pointOnPath, presetDisplacement } from './logoPresets';

export function initializeLogo(root, { delay = 0, interactive = true, idPrefix = "logo", strokeWidth = 8, expressive = false } = {}) {
  const subscriptions=[];
  const listen=(target,event,handler)=>{if(!target)return;target.addEventListener(event,handler);subscriptions.push(()=>target.removeEventListener(event,handler));};
  // Centerline paths, reconstructed from the supplied white mark. No background geometry.
  const paths = LOGO_PATHS;
  const stage=root.querySelector('[data-logo-stage], #stage'), bloom=root.querySelector('[data-logo-bloom], #bloom'), lines=root.querySelector('[data-logo-lines], #lines');
  const pause=root.querySelector('#pause'), label=root.querySelector('#pause-label'), icon=root.querySelector('#pause-icon'), hint=root.querySelector('#hint');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  // Keep the Intercom colors; the third line uses their solid RGB midpoint.
  const defs=root.querySelector('[data-logo-mark] defs, #mark defs');
  [['purple-pink','#7c3aed','#f45fd2','42%','58%'],['pink-purple','#f45fd2','#7c3aed','42%','58%']].forEach(([id,start,end,startOffset,endOffset])=>{
    const gradient=document.createElementNS('http://www.w3.org/2000/svg','linearGradient');
    gradient.id=idPrefix+'-'+id;gradient.setAttribute('x1','0');gradient.setAttribute('x2','1');gradient.setAttribute('y1','0');gradient.setAttribute('y2','0');
    [[startOffset,start],[endOffset,end]].forEach(([offset,color])=>{const stop=document.createElementNS('http://www.w3.org/2000/svg','stop');stop.setAttribute('offset',offset);stop.setAttribute('stop-color',color);gradient.append(stop);});
    defs.append(gradient);
  });
  const palette=[`url(#${idPrefix}-purple-pink)`,`url(#${idPrefix}-pink-purple)`,'#b84ddd','#ffffff'];
  const eyeLines=document.createElementNS('http://www.w3.org/2000/svg','g');
  const eyeBloom=document.createElementNS('http://www.w3.org/2000/svg','g');
  lines.append(eyeLines);bloom.append(eyeBloom);
  const layers=palette.map(color => {
    const create=parent=>{const p=document.createElementNS('http://www.w3.org/2000/svg','path');p.setAttribute('fill','none');p.setAttribute('stroke',color);p.setAttribute('stroke-width',String(strokeWidth));p.setAttribute('stroke-linejoin','miter');p.setAttribute('stroke-linecap','square');parent.append(p);return p;};
    return { glow:create(bloom),line:create(lines),eyeGlow:create(eyeBloom),eyeLine:create(eyeLines) };
  });
  // Light-only ignition at the start of the perimeter; no whole-mark movement.
  const glint=expressive?document.createElementNS('http://www.w3.org/2000/svg','g'):null;
  if(glint){
    const [x,y]=pointOnPath(2,0);
    for(const [radius,color,opacity] of [[9,'#7c3aed',.25],[4,'#f45fd2',.65],[1.7,'#ffe5fc',1]]){
      const dot=document.createElementNS('http://www.w3.org/2000/svg','circle');
      dot.setAttribute('cx',String(x));dot.setAttribute('cy',String(y));
      dot.setAttribute('r',String(radius));dot.setAttribute('fill',color);dot.setAttribute('opacity',String(opacity));
      glint.append(dot);
    }
    glint.setAttribute('opacity','0');lines.append(glint);
  }
  const segments=paths.map(path=>path.slice(1).map((b,i)=>{const a=path[i],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);return {a,b,len,nx:-dy/len,ny:dx/len};}));
  segments.forEach(group=>{let offset=0;const total=group.reduce((sum,s)=>sum+s.len,0);group.forEach(s=>{s.offset=offset;s.total=total;offset+=s.len;});});
  let paused=reduced.matches,hover=false,down=false,px=260,py=260,tx=260,ty=260,amount=0,time=0,last=0,raf=0,demoStart=paused?-100:delay*1.25;
  // Fixed travel speed; oscillation always uses real elapsed time.
  let wiggleTime=0,demoWiggleStart=delay;
  const mode='braking',speed=1.25;
  let looping=false;
  const loopButton=root.querySelector('#loop');
  const smooth=x=>x*x*(3-2*x);
  function draw(){
    const rippleAge=time-demoStart;
    const activeAge=wiggleTime-demoWiggleStart;
    if(glint){
      const ignition=!paused&&activeAge>-.28&&activeAge<.24
        ? (activeAge<0?smooth((activeAge+.28)/.28):1-smooth(activeAge/.24)) : 0;
      glint.setAttribute('opacity',String(ignition));
    }
    layers.forEach((layer,l)=>{
      // The white reference path is written once and never animated.
      if(l===3&&layer.line.hasAttribute('d'))return;
      let d='';
      segments.forEach((group,groupIndex)=>group.forEach((s,si)=>{
        const count=Math.ceil(s.len*1.5);
        for(let j=0;j<=count;j++){
          if(si&&j===0)continue;
          const u=j/count,x=260+(s.a[0]+(s.b[0]-s.a[0])*u-65)*4.1,y=260+(s.a[1]+(s.b[1]-s.a[1])*u-58)*4.1;
          const distance=Math.hypot(x-px,y-py);
          // Hover is strictly local; each preset explicitly selects its own strokes.
          const hoverInfluence=1-smooth(Math.min(1,distance/80));
          const anchor=smooth(Math.min(1,u*6))*smooth(Math.min(1,(1-u)*6));
          const motion=hover
            ? Math.sin(u*s.len*.27-wiggleTime*9.5+l*1.15+si*.5)*amount*hoverInfluence
            : presetDisplacement(mode,rippleAge,groupIndex,x,y,l,(s.offset+u*s.len)/s.total,wiggleTime-demoWiggleStart);
          const stationary=paused||l===3;
          const displacement=stationary?0:motion*anchor*[1,.86,.74,.54][l];
          const movedX=x+s.nx*displacement,movedY=y+s.ny*displacement;
          const [finalX,finalY]=[movedX,movedY];
          d+=(si===0&&j===0?'M':'L')+finalX.toFixed(2)+' '+finalY.toFixed(2)+' ';
        }
      }));
      const eyeStart=d.lastIndexOf('M');
      const eyePath=d.slice(eyeStart),bodyPath=d.slice(0,eyeStart);
      layer.line.setAttribute('d',bodyPath);layer.glow.setAttribute('d',bodyPath);
      layer.eyeLine.setAttribute('d',eyePath);layer.eyeGlow.setAttribute('d',eyePath);
    });
  }
  function frame(now){
    raf=0;if(document.hidden)return;
    const dt=last?Math.min((now-last)/1000,.05):.016;last=now;
    if(!paused){time+=dt*speed;wiggleTime+=dt;}
    if(looping&&!hover&&time-demoStart>=LOGO_PRESETS[mode].duration+.8){demoStart=time;demoWiggleStart=wiggleTime;}
    const target=hover?16:0;
    amount+=(target-amount)*(1-Math.exp(-dt*8));px+=(tx-px)*(1-Math.exp(-dt*15));py+=(ty-py)*(1-Math.exp(-dt*15));
    draw();if(!paused&&(interactive||ripplePending()))raf=requestAnimationFrame(frame);
  }
  function ripplePending(){return time-demoStart<LOGO_PRESETS[mode].duration;}
  function start(){if(!raf){last=0;raf=requestAnimationFrame(frame);}}
  function setPaused(value){paused=value;pause?.setAttribute('aria-pressed',String(paused));if(label)label.textContent=paused?'Resume':'Pause';if(icon)icon.textContent=paused?'▷':'Ⅱ';if(hint)hint.textContent=paused?'Motion paused. The mark, at rest.':'Move through the mark. Feel the wave.';if(paused){cancelAnimationFrame(raf);raf=0;draw();}else start();}
  function point(e){const r=stage.getBoundingClientRect();tx=(e.clientX-r.left)/r.width*520;ty=(e.clientY-r.top)/r.height*520;}
  function beginHover(e){point(e);if(!hover){px=tx;py=ty;}demoStart=-100;hover=true;}
  function demo(){setPaused(false);hover=false;demoStart=time;demoWiggleStart=wiggleTime;start();}
  if(interactive){
  listen(stage,'pointerenter',e=>{if(e.pointerType!=='touch')beginHover(e);});
  listen(stage,'pointermove',e=>{if(e.pointerType!=='touch'||down)beginHover(e);});
  listen(stage,'pointerleave',()=>{hover=false;});
  listen(stage,'pointerdown',e=>{down=true;beginHover(e);stage.setPointerCapture(e.pointerId);});
  const release=()=>{down=false;hover=false;};listen(stage,'pointerup',release);listen(stage,'pointercancel',release);
  listen(stage,'keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();demo();}});
  }
  listen(loopButton,'click',()=>{looping=!looping;loopButton.setAttribute('aria-pressed',String(looping));if(looping)demo();});
  listen(root.querySelector('#replay'),'click',demo);listen(pause,'click',()=>setPaused(!paused));
  listen(document,'visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;}else if(!paused)start();});
  listen(reduced,'change',e=>setPaused(e.matches));
  setPaused(paused);draw();
  return () => {
    cancelAnimationFrame(raf);
    subscriptions.forEach(unsubscribe=>unsubscribe());
    layers.forEach(layer=>{layer.line.remove();layer.glow.remove();layer.eyeLine.remove();layer.eyeGlow.remove();});
    eyeLines.remove();eyeBloom.remove();glint?.remove();
    defs.querySelectorAll('linearGradient').forEach(gradient=>gradient.remove());
  };
}
