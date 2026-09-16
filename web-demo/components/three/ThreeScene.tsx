"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { SAMPLE_BEADS, activatedColor, dampUv } from "@/lib/bead";
import { braceletSlots, faceOutward } from "@/lib/bracelet";
import { CORONA_RADIUS, SUN_RADIUS, coronaFragment, sunFragment, sunVertex } from "@/lib/sunShader";
import { UvPanel } from "@/components/UvPanel";

const SUN_POSITION = new THREE.Vector3(2.2, 1.4, -4);

export default function ThreeScene() {
  const mountRef = useRef<HTMLDivElement>(null);
  const readoutRef = useRef<HTMLSpanElement>(null);
  const [targetUv, setTargetUv] = useState(8);
  const [auto, setAuto] = useState(true);

  // 렌더 루프는 React 바깥에서 돌기 때문에 최신 조절값을 ref로 넘긴다
  const control = useRef({ targetUv, auto });
  useEffect(() => {
    control.current = { targetUv, auto };
  }, [targetUv, auto]);

  useEffect(() => {
    const mount = mountRef.current!;

    // 1) 렌더러: 캔버스를 만들어 붙인다
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    mount.appendChild(renderer.domElement);

    // 2) 장면 + 카메라 + 조명
    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTexture; // 레진 광택에 비칠 주변 환경
    scene.environmentIntensity = 0.7;

    const camera = new THREE.PerspectiveCamera(35, mount.clientWidth / mount.clientHeight, 0.1, 100);
    camera.position.set(0, 0.8, 9);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.minPolarAngle = Math.PI * 0.3;
    controls.maxPolarAngle = Math.PI * 0.62;

    const sunLight = new THREE.DirectionalLight("#ffc48a", 1);
    sunLight.position.copy(SUN_POSITION);
    const fill = new THREE.DirectionalLight("#fff1e0", 0.5);
    fill.position.set(-3, 2, 6);
    scene.add(sunLight, fill, new THREE.AmbientLight("#fff4e8", 0.25));

    // 3) 태양: 셰이더 구 + 뒷면만 그린 코로나 구
    const sunUniforms = { uTime: { value: 0 }, uHeat: { value: 0 } };
    const sunGeo = new THREE.SphereGeometry(SUN_RADIUS, 128, 128);
    const sunMat = new THREE.ShaderMaterial({ vertexShader: sunVertex, fragmentShader: sunFragment, uniforms: sunUniforms });
    const coronaGeo = new THREE.SphereGeometry(CORONA_RADIUS, 96, 96);
    const coronaMat = new THREE.ShaderMaterial({
      vertexShader: sunVertex,
      fragmentShader: coronaFragment,
      uniforms: sunUniforms,
      side: THREE.BackSide,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const sun = new THREE.Mesh(sunGeo, sunMat);
    const corona = new THREE.Mesh(coronaGeo, coronaMat);
    sun.position.copy(SUN_POSITION);
    corona.position.copy(SUN_POSITION);
    scene.add(sun, corona);

    // 4) 팔찌: 둥근 사각 비즈 9개 + 스페이서 + 줄
    const tilt = new THREE.Group();
    tilt.position.set(-0.4, -0.5, 0.5);
    tilt.rotation.x = 0.42;
    const bracelet = new THREE.Group();
    tilt.add(bracelet);

    const { beads, spacers } = braceletSlots(SAMPLE_BEADS.length, 1.9);
    const beadGeo = new RoundedBoxGeometry(0.66, 0.66, 0.22, 5, 0.1);
    const beadMats = SAMPLE_BEADS.map(
      () => new THREE.MeshPhysicalMaterial({ color: "#f7f4ee", roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.12 }),
    );
    beads.forEach((slot, i) => {
      const mesh = new THREE.Mesh(beadGeo, beadMats[i]);
      mesh.position.set(slot.x, slot.y, slot.z);
      mesh.rotation.y = faceOutward(slot.angle);
      bracelet.add(mesh);
    });

    const spacerGeo = new THREE.SphereGeometry(0.1, 32, 32);
    const spacerMat = new THREE.MeshPhysicalMaterial({ color: "#e9e2d6", roughness: 0.2, clearcoat: 1 });
    spacers.forEach((slot) => {
      const mesh = new THREE.Mesh(spacerGeo, spacerMat);
      mesh.position.set(slot.x, slot.y, slot.z);
      bracelet.add(mesh);
    });

    const cordGeo = new THREE.TorusGeometry(1.9, 0.018, 12, 200);
    const cordMat = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.3, transparent: true, opacity: 0.7 });
    const cord = new THREE.Mesh(cordGeo, cordMat);
    cord.rotation.x = Math.PI / 2;
    bracelet.add(cord);
    scene.add(tilt);

    // 5) 매 프레임: 자외선값을 부드럽게 따라가고(보간) → 태양·조명·비즈 색에 반영
    let uv = control.current.targetUv;
    let last = performance.now();
    const start = last;
    let raf = 0;
    const tick = () => {
      // rAF가 넘겨주는 시각은 긴 로딩 직후 첫 프레임에서 performance.now()보다 과거일 수 있다
      // (실측: -5.3초) → 두 시계를 섞지 않고 performance.now() 하나만 쓴다
      const now = performance.now();
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const t = (now - start) / 1000;
      const { auto, targetUv } = control.current;
      const target = auto ? 5.5 + 5.5 * Math.sin(t * 0.3) : targetUv;
      uv = dampUv(uv, target, dt);

      const heat = uv / 11;
      sunUniforms.uTime.value = t;
      sunUniforms.uHeat.value = heat;
      sunLight.intensity = 0.4 + heat * 2.6;
      beadMats.forEach((mat, i) => mat.color.set(activatedColor(SAMPLE_BEADS[i], uv)));
      bracelet.rotation.y = t * 0.18;

      controls.update();
      renderer.render(scene, camera);
      if (readoutRef.current) readoutRef.current.textContent = uv.toFixed(1);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    // 창 크기가 바뀌면 캔버스와 카메라 비율 갱신
    const resize = new ResizeObserver(() => {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    });
    resize.observe(mount);

    // 6) 정리: React가 컴포넌트를 치울 때 GPU 메모리도 직접 비워야 한다
    return () => {
      cancelAnimationFrame(raf);
      resize.disconnect();
      controls.dispose();
      [sunGeo, coronaGeo, beadGeo, spacerGeo, cordGeo].forEach((g) => g.dispose());
      [sunMat, coronaMat, spacerMat, cordMat, ...beadMats].forEach((m) => m.dispose());
      envTexture.dispose();
      pmrem.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div className="stage">
      <div ref={mountRef} className="stage-mount" />
      <UvPanel targetUv={targetUv} auto={auto} readoutRef={readoutRef} onTargetUv={setTargetUv} onAuto={setAuto} />
    </div>
  );
}
