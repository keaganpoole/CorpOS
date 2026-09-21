import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

// A deliberately sculptural subject: porcelain, graphite and brushed metal.
// No model downloads, textures, postprocessing passes or facial lip-sync.
export default function ReceptionistScene({ stage, values, audioLevel, reducedMotion, quiet = false }) {
  const host = useRef(null);
  const state = useRef({ stage, values, reducedMotion, quiet });
  state.current = { stage, values, reducedMotion, quiet };
  const [fallback, setFallback] = useState(false);
  useEffect(() => {
    const el = host.current;
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' }); }
    catch { setFallback(true); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2('#070707', 0.055);
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 60);
    const target = new THREE.Vector3(-1.05, 1.8, 0);
    camera.position.set(4.5, 3.1, 8.9);
    const graphite = new THREE.MeshStandardMaterial({ color: '#191a1a', roughness: 0.72, metalness: 0.16 });
    const black = new THREE.MeshStandardMaterial({ color: '#0e0f10', roughness: 0.36, metalness: 0.3 });
    const porcelain = new THREE.MeshStandardMaterial({ color: '#c8bca8', roughness: 0.57, metalness: 0.08 });
    const hair = new THREE.MeshStandardMaterial({ color: '#34302c', roughness: 0.8 });
    const silver = new THREE.MeshStandardMaterial({ color: '#a49d8e', roughness: 0.32, metalness: 0.75 });
    const paper = new THREE.MeshStandardMaterial({ color: '#b9b4a7', roughness: 1 });
    const mesh = (geo, mat, parent, x, y, z, sx = 1, sy = 1, sz = 1) => {
      const obj = new THREE.Mesh(geo, mat); obj.position.set(x,y,z); obj.scale.set(sx,sy,sz);
      obj.castShadow = true; obj.receiveShadow = true; parent.add(obj); return obj;
    };
    const box = (parent, mat, x,y,z,w,h,d) => mesh(new THREE.BoxGeometry(w,h,d),mat,parent,x,y,z);
    const oval = (parent, mat, x,y,z,w,h,d) => mesh(new THREE.SphereGeometry(1,40,28),mat,parent,x,y,z,w,h,d);
    const cylinder = (parent, mat, x,y,z,r1,r2,h) => mesh(new THREE.CylinderGeometry(r1,r2,h,48),mat,parent,x,y,z);
    const tube = (parent, mat, points, radius) => mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))),32,radius,8,false),mat,parent,0,0,0);
    const floor = box(scene, graphite, 0,-0.06,0,30,0.1,30); floor.castShadow = false;
    box(scene, black, 0,3.2,-3.5,16,6.5,0.15);
    for (let i = -12; i < 13; i++) box(scene, graphite,i*.34,2.7,-3.34,.075,5.4,.16);
    // Wall reveal and restrained warm light rather than an emissive backdrop.
    box(scene,silver,3.9,2.7,-3.2,.025,5.4,.04);
    const lightMat = new THREE.MeshBasicMaterial({ color: '#ddd1b8' });
    box(scene,lightMat,-2.6,3,-3.18,.018,3.8,.03);
    const desk = new THREE.Group(); scene.add(desk);
    box(desk,black,0,1.33,.8,4.1,.18,1.65);
    box(desk,graphite,0,1.13,1.46,3.9,.22,.14);
    box(desk,black,-1.65,.65,.8,.32,1.3,1.35);
    box(desk,black,1.65,.65,.8,.32,1.3,1.35);
    box(desk,silver,0,1.425,1.5,3.8,.012,.025);
    for(let i=0;i<28;i++) box(desk,graphite,-1.78+i*.13,1.1,1.54,.018,.18,.008);
    // A slim monitor, notebook, pencil and table lamp establish scale.
    const monitor = box(scene,graphite,.92,1.86,.62,.85,.55,.045); monitor.rotation.y=-.28;
    box(scene,silver,.92,1.51,.59,.06,.22,.06); box(scene,black,.92,1.435,.59,.4,.025,.25);
    const notebook = box(scene,paper,-.9,1.435,1,.38,.025,.5); notebook.rotation.y=.18;
    tube(scene,silver,[[-.58,1.455,.8],[-.55,1.455,1.16]],.009);
    cylinder(scene,black,-1.63,1.46,.4,.17,.19,.06);
    tube(scene,silver,[[-1.63,1.47,.4],[-1.63,2.15,.4],[-1.36,2.3,.4]],.016);
    const shade = cylinder(scene,black,-1.34,2.26,.4,.12,.23,.16); shade.rotation.z=.25;
    const lamp = new THREE.PointLight('#ffe2b5',2,3); lamp.position.set(-1.34,2.12,.4); scene.add(lamp);
    // Seat and tailored abstract figure.
    oval(scene,black,0,1.45,-.6,.64,.82,.13);
    const person = new THREE.Group(); person.position.set(0,0,-.25); scene.add(person);
    oval(person,graphite,0,1.7,0,.44,.62,.25);
    oval(person,graphite,-.39,1.77,.07,.14,.35,.17).rotation.z=-.22;
    oval(person,graphite,.39,1.77,.07,.14,.35,.17).rotation.z=.22;
    const armL=oval(person,graphite,-.4,1.47,.43,.15,.15,.48); armL.rotation.y=.24;
    const armR=oval(person,graphite,.4,1.47,.43,.15,.15,.48); armR.rotation.y=-.24;
    oval(person,porcelain,-.25,1.48,.79,.13,.065,.2);
    oval(person,porcelain,.25,1.48,.79,.13,.065,.2);
    oval(person,paper,0,1.98,.21,.14,.28,.03);
    for (const side of [-1,1]) {
      const shape=new THREE.Shape(); shape.moveTo(side*.12,2.18);shape.lineTo(side*.3,2.05);shape.lineTo(side*.21,1.98);shape.lineTo(side*.25,1.88);shape.lineTo(side*.03,1.58);shape.closePath();
      mesh(new THREE.ShapeGeometry(shape),black,person,0,0,.267);
    }
    cylinder(person,porcelain,0,2.26,0,.13,.16,.35);
    const head = new THREE.Group(); head.position.set(0,2.63,0); person.add(head);
    const face=oval(head,porcelain,0,0,0,.3,.4,.28);
    oval(head,porcelain,0,-.07,.255,.043,.075,.055); // understated nose
    for(const side of [-1,1]) {
      oval(head,hair,side*.11,.015,.251,.04,.022,.02);
      tube(head,hair,[[side*.06,.105,.25],[side*.11,.117,.247],[side*.16,.102,.231]],.009);
      oval(head,porcelain,side*.295,-.035,-.025,.042,.073,.04);
    }
    tube(head,hair,[[-.065,-.175,.247],[0,-.182,.26],[.065,-.175,.247]],.006);
    oval(head,hair,0,.18,-.045,.31,.255,.28);
    const hairBack=oval(head,hair,0,-.07,-.2,.32,.42,.16);
    const fringe=oval(head,hair,-.1,.24,.14,.24,.12,.15); fringe.rotation.z=.25;
    // Fine headset, so the character is visibly the voice's source.
    tube(head,black,[[-.32,0,0],[-.29,.28,0],[0,.43,0],[.29,.28,0],[.32,0,0]],.025);
    oval(head,black,.32,-.015,0,.047,.095,.07);
    tube(head,silver,[[.34,-.03,.015],[.33,-.19,.19],[.16,-.23,.31]],.012);
    oval(head,black,.15,-.23,.31,.045,.024,.025);
    const key = new THREE.SpotLight('#fff2dc',55,20,.65,.8,1.5); key.position.set(2.8,6,5); key.target.position.set(0,1.8,0); key.castShadow=true; key.shadow.mapSize.set(1024,1024); key.shadow.bias=-.001; scene.add(key,key.target);
    const fill=new THREE.DirectionalLight('#d0d8df',2.2); fill.position.set(-4,3,4); scene.add(fill);
    const rim=new THREE.DirectionalLight('#ede0c8',3.5); rim.position.set(2,4,-3); scene.add(rim);
    scene.add(new THREE.HemisphereLight('#b1aaa0','#161616',1.1));
    const resize = () => { const w=el.clientWidth,h=el.clientHeight; if(!w||!h)return; renderer.setSize(w,h); camera.aspect=w/h; camera.updateProjectionMatrix(); };
    const observer=new ResizeObserver(resize); observer.observe(el); resize();
    let frame=0, last=0, lastInteraction=performance.now(), lastKey='', visible=true;
    const clock=new THREE.Clock();
    const render = now => {
      frame=requestAnimationFrame(render);
      if(!visible || document.hidden || now-last<32) return;
      last=now;
      const s=state.current, time=clock.getElapsedTime(), level=audioLevel?.current || 0;
      const signature=JSON.stringify([s.stage,s.values,s.reducedMotion,el.clientWidth,el.clientHeight]);
      const changed=signature!==lastKey;
      if(changed) { lastKey=signature; lastInteraction=now; }
      const control=s.stage>=5, portrait=s.stage>=2;
      const mobile=el.clientWidth<700;
      const compositions=[[4.5,3.1,8.9],[3.2,3.05,7.7],[1.8,2.85,6.7],[1.55,2.8,6.5],[1.3,2.8,6.3],[2.5,2.95,7.5],[1.7,2.8,6.7],[2.5,3,7.8]];
      const position=new THREE.Vector3(...compositions[s.stage]);
      const aim=new THREE.Vector3(control||mobile?0:-1.05,portrait?2.1:1.8,0);
      const factor=s.reducedMotion?1:.045;
      camera.position.lerp(position,factor); target.lerp(aim,factor); camera.lookAt(target);
      const feminine=s.values.gender==='Feminine';
      const masculine=s.values.gender==='Masculine';
      hairBack.scale.y=THREE.MathUtils.lerp(hairBack.scale.y,feminine?.46:.24,factor);
      face.scale.x=THREE.MathUtils.lerp(face.scale.x,masculine?.32:.29,factor);
      porcelain.color.lerp(new THREE.Color(s.values.age==='Mature'?'#c0b9ab':'#c8bca8'),factor);
      hair.color.lerp(new THREE.Color(s.values.age==='Mature'?'#77736d':'#34302c'),factor);
      const alive=!s.reducedMotion&&!s.quiet&&(now-lastInteraction<7000||level>.01);
      const energy=s.values.tone==='Upbeat'||s.values.personality?.includes('Energetic')?1.3:1;
      const relaxed=s.values.personality?.includes('Relaxed');
      person.rotation.x=THREE.MathUtils.lerp(person.rotation.x,relaxed?-.025:0,factor);
      key.color.lerp(new THREE.Color(['Warm','Friendly'].includes(s.values.tone)?'#ffe3bd':'#fff2dc'),factor);
      head.rotation.x=THREE.MathUtils.lerp(head.rotation.x,alive?Math.sin(time*1.5)*.012*energy+level*.055:0,.12);
      head.rotation.y=THREE.MathUtils.lerp(head.rotation.y,alive?Math.sin(time*.65)*.025:0,.1);
      person.position.y=alive?Math.sin(time*1.3)*.006:0;
      if(changed || (!s.reducedMotion && (alive || now-lastInteraction<5000))) renderer.render(scene,camera);
    };
    const visibility=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)lastInteraction=performance.now();}); visibility.observe(el);
    const lost=event=>{event.preventDefault();setFallback(true);cancelAnimationFrame(frame);};
    renderer.domElement.addEventListener('webglcontextlost',lost);
    frame=requestAnimationFrame(render);
    return()=>{cancelAnimationFrame(frame);observer.disconnect();visibility.disconnect();renderer.domElement.removeEventListener('webglcontextlost',lost);scene.traverse(obj=>{obj.geometry?.dispose();}); new Set([graphite,black,porcelain,hair,silver,paper,lightMat]).forEach(mat=>mat.dispose());renderer.dispose();renderer.domElement.remove();};
  }, [audioLevel]);
  return <div className={`ns-scene ${fallback?'ns-scene--fallback':''}`} ref={host} role="img" aria-label="A sculptural receptionist at a black desk in a softly lit Nodemere studio">{fallback&&<div className="ns-sculpture"><i/><b/><span/></div>}</div>;
}
