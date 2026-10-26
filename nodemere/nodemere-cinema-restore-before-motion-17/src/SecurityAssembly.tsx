import { useLayoutEffect, useRef, useState } from "react";
import { useDelayRender, useVideoConfig } from "remotion";
import * as THREE from "three";
import { p, mix, glide, brand } from "./design";

function outline(r: number, c: number) {
  return [
    [-r + c, -r],
    [r - c, -r],
    [r, -r + c],
    [r, r - c],
    [r - c, r],
    [-r + c, r],
    [-r, r - c],
    [-r, -r + c],
  ];
}
function trace(path: THREE.Path, points: number[][]) {
  points.forEach(([x, y], i) => (i ? path.lineTo(x, y) : path.moveTo(x, y)));
  path.closePath();
}
function plate(radius: number, cut: number, depth: number, inner?: number) {
  const shape = new THREE.Shape();
  trace(shape, outline(radius, cut));
  if (inner) {
    const hole = new THREE.Path();
    trace(
      hole,
      outline(inner, Math.max(2, cut - (radius - inner) * 0.585786)).reverse(),
    );
    shape.holes.push(hole);
  }
  return new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: !inner || radius - inner > 6,
    bevelThickness: 2.2,
    bevelSize: 2.2,
    bevelSegments: 4,
    steps: 1,
    curveSegments: 1,
  });
}
type Rig = { draw: (time: number) => void; dispose: () => void };

/** Deterministic procedural solid geometry, studio-lit with a local environment.
 * A visual metaphor for layered, business-specific protection; not a system diagram.
 * No external media, timers, live data, random values, or frame-to-frame simulation.
 */
export function SecurityAssembly({ time }: { time: number }) {
  const canvas = useRef<HTMLCanvasElement>(null),
    rig = useRef<Rig | null>(null);
  const { width, height } = useVideoConfig();
  const { delayRender, continueRender } = useDelayRender();
  const [ready] = useState(() =>
    delayRender("Preparing deterministic security geometry"),
  );
  useLayoutEffect(() => {
    if (!canvas.current) return;
    const renderer = new THREE.WebGLRenderer({
      canvas: canvas.current,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height, false);
    renderer.setPixelRatio(1);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    const scene = new THREE.Scene(),
      assembly = new THREE.Group();
    scene.add(assembly);
    const camera = new THREE.PerspectiveCamera(25.36, width / height, 10, 8000);
    camera.position.set(0, 0, 2400);
    // Broad white reflection cards. None of this environment is drawn behind the subject.
    const studio = new THREE.Scene();
    studio.background = new THREE.Color(0x080808);
    const card = (
      x: number,
      y: number,
      z: number,
      w: number,
      h: number,
      power: number,
    ) => {
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(power, power, power),
          side: THREE.DoubleSide,
        }),
      );
      plane.position.set(x, y, z);
      plane.lookAt(0, 0, 0);
      studio.add(plane);
    };
    card(-650, 550, 750, 280, 1500, 6);
    card(500, 900, 250, 1800, 180, 4);
    card(750, 100, 200, 160, 1300, 3);
    card(0, -600, 550, 900, 120, 1.5);
    card(-900, -650, 250, 650, 1500, 5);
    const pmrem = new THREE.PMREMGenerator(renderer),
      environment = pmrem.fromScene(studio, 0.04);
    scene.environment = environment.texture;
    scene.environmentIntensity = 1.1;
    const key = new THREE.DirectionalLight(0xffffff, 2);
    key.position.set(-500, 700, 1000);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 1);
    fill.position.set(800, -100, 700);
    scene.add(fill);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x080808, 0.6));
    const softbox = new THREE.PointLight(0xffffff, 3500000, 0, 2);
    softbox.position.set(-450, 400, 650);
    scene.add(softbox);
    const body = new THREE.MeshStandardMaterial({
      color: 0x87878d,
      metalness: 0.82,
      roughness: 0.32,
    });
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x5e5e64,
      metalness: 0.7,
      roughness: 0.38,
    });
    const grooveMat = new THREE.MeshStandardMaterial({
      color: 0x070708,
      metalness: 0.7,
      roughness: 0.48,
    });
    const rings: THREE.Group[] = [],
      cores: THREE.Group[] = [];
    for (let i = 0; i < 5; i++) {
      const group = new THREE.Group();
      const ring = new THREE.Mesh(
        plate(348 - i * 3, 48, 32, 270 - i * 2),
        body,
      );
      group.add(ring);
      // Close-tolerance dark gasket underneath each metal lamination.
      const gasket = new THREE.Mesh(
        plate(345 - i * 3, 46, 2.5, 270 - i * 2),
        grooveMat,
      );
      gasket.position.z = -4;
      group.add(gasket);
      rings.push(group);
      assembly.add(group);
    }
    for (let i = 0; i < 4; i++) {
      const group = new THREE.Group();
      group.position.x = (i % 2 === 0 ? -1 : 1) * 128;
      group.position.y = (i < 2 ? 1 : -1) * 128;
      group.add(new THREE.Mesh(plate(124, 14, 22), coreMat));
      const seal = new THREE.Mesh(plate(113, 10, 0.35, 111.9), grooveMat);
      seal.position.z = 24.3;
      group.add(seal);
      cores.push(group);
      assembly.add(group);
    }
    // A single fine inlay on the face, using the exact two brand colors.
    const seamGeometry = plate(320, 39, 0.5, 319.1);
    const seamMat = new THREE.ShaderMaterial({
      uniforms: {
        pink: { value: new THREE.Color(brand.pink) },
        purple: { value: new THREE.Color(brand.purple) },
        amount: { value: 0 },
      },
      vertexShader:
        "varying vec2 location; void main(){location=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
      fragmentShader:
        "varying vec2 location;uniform vec3 pink;uniform vec3 purple;uniform float amount;void main(){float k=clamp((location.x+location.y+640.)/1280.,0.,1.);gl_FragColor=vec4(mix(purple,pink,k)*.7,amount);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}",
      transparent: true,
      depthWrite: false,
    });
    const seam = new THREE.Mesh(seamGeometry, seamMat);
    seam.position.z = 34.6;
    rings[4].add(seam);
    const draw = (t: number) => {
      const pull = p(t, 2.7, 10.9, glide);
      assembly.rotation.set(
        THREE.MathUtils.degToRad(mix(62, 29, pull)),
        THREE.MathUtils.degToRad(mix(-31, -22, pull)),
        THREE.MathUtils.degToRad(mix(23, 7, pull)),
        "ZYX",
      );
      const scale = mix(2.65, 0.97, pull);
      assembly.scale.setScalar(scale);
      assembly.position.set(mix(320, 0, pull), mix(-180, 70, pull), 0);
      // Contract the gaps, not independent plate positions: the ordered layers
      // retain physical clearance throughout the staggered assembly.
      const gaps = [0, 1, 2, 3].map((i) =>
        mix(175, 39, p(t, 4 + i * 0.67, 6.25 + i * 0.67, glide)),
      );
      const depths = [
        -gaps[0] - gaps[1],
        -gaps[1],
        0,
        gaps[2],
        gaps[2] + gaps[3],
      ];
      rings.forEach((g, i) => {
        g.position.z = depths[i];
      });
      cores.forEach((g, i) => {
        g.position.z = mix(
          -150,
          83,
          p(t, 7.25 + i * 0.18, 9.35 + i * 0.18, glide),
        );
      });
      seamMat.uniforms.amount.value = p(t, 8.8, 10.1, glide);
      renderer.render(scene, camera);
    };
    rig.current = {
      draw,
      dispose: () => {
        scene.traverse((o) => {
          if (o instanceof THREE.Mesh) o.geometry.dispose();
        });
        studio.traverse((o) => {
          if (o instanceof THREE.Mesh) {
            o.geometry.dispose();
            (o.material as THREE.Material).dispose();
          }
        });
        [body, coreMat, grooveMat, seamMat].forEach((m) => m.dispose());
        environment.dispose();
        pmrem.dispose();
        renderer.dispose();
      },
    };
    return () => {
      rig.current?.dispose();
      rig.current = null;
    };
  }, [width, height, continueRender, ready]);
  useLayoutEffect(() => {
    rig.current?.draw(time);
    // Release first-frame capture after geometry and text metrics are both ready.
    void document.fonts.ready.then(() => continueRender(ready));
  }, [time, width, height, continueRender, ready]);
  return (
    <canvas
      ref={canvas}
      width={width}
      height={height}
      aria-label="Abstract layered security assembly"
      style={{ display: "block", width: 1920, height: 1080 }}
    />
  );
}
