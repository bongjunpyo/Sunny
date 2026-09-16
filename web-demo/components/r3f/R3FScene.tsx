"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, RoundedBox } from "@react-three/drei";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { SAMPLE_BEADS, activatedColor, dampUv } from "@/lib/bead";
import { braceletSlots, faceOutward } from "@/lib/bracelet";
import { CORONA_RADIUS, SUN_RADIUS, coronaFragment, sunFragment, sunVertex } from "@/lib/sunShader";
import { UvPanel } from "@/components/UvPanel";

type Control = { targetUv: number; auto: boolean };
const SUN_POSITION: [number, number, number] = [2.2, 1.4, -4];

// 자외선값 보간: React 상태를 매 프레임 바꾸면 느려지므로 ref 값만 바꾼다
function UvDriver({ control, uv, readout }: { control: RefObject<Control>; uv: RefObject<number>; readout: RefObject<HTMLSpanElement | null> }) {
  useFrame(({ clock }, delta) => {
    const { auto, targetUv } = control.current;
    const target = auto ? 5.5 + 5.5 * Math.sin(clock.elapsedTime * 0.3) : targetUv;
    uv.current = dampUv(uv.current, target, Math.min(delta, 0.05));
    if (readout.current) readout.current.textContent = uv.current.toFixed(1);
  });
  return null;
}

// Three.js에 없는 기능이 필요하면 useThree로 원래 객체를 꺼내 쓸 수 있다
function RoomLight() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const texture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = texture;
    scene.environmentIntensity = 0.7;
    return () => {
      scene.environment = null;
      texture.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  return null;
}

function Sun({ uv }: { uv: RefObject<number> }) {
  const sunMat = useRef<THREE.ShaderMaterial>(null);
  const coronaMat = useRef<THREE.ShaderMaterial>(null);
  const light = useRef<THREE.DirectionalLight>(null);
  const sunUniforms = useMemo(() => ({ uTime: { value: 0 }, uHeat: { value: 0 } }), []);
  const coronaUniforms = useMemo(() => ({ uTime: { value: 0 }, uHeat: { value: 0 } }), []);

  useFrame(({ clock }) => {
    const heat = uv.current / 11;
    for (const mat of [sunMat.current, coronaMat.current]) {
      if (!mat) continue;
      mat.uniforms.uTime.value = clock.elapsedTime;
      mat.uniforms.uHeat.value = heat;
    }
    if (light.current) light.current.intensity = 0.4 + heat * 2.6;
  });

  return (
    <>
      <group position={SUN_POSITION}>
        <mesh>
          <sphereGeometry args={[SUN_RADIUS, 128, 128]} />
          <shaderMaterial ref={sunMat} vertexShader={sunVertex} fragmentShader={sunFragment} uniforms={sunUniforms} />
        </mesh>
        <mesh>
          <sphereGeometry args={[CORONA_RADIUS, 96, 96]} />
          <shaderMaterial
            ref={coronaMat}
            vertexShader={sunVertex}
            fragmentShader={coronaFragment}
            uniforms={coronaUniforms}
            side={THREE.BackSide}
            transparent
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      </group>
      <directionalLight ref={light} position={SUN_POSITION} color="#ffc48a" />
    </>
  );
}

function Bracelet({ uv }: { uv: RefObject<number> }) {
  const spin = useRef<THREE.Group>(null);
  const materials = useRef<(THREE.MeshPhysicalMaterial | null)[]>([]);
  const { beads, spacers } = useMemo(() => braceletSlots(SAMPLE_BEADS.length, 1.9), []);

  useFrame(({ clock }) => {
    if (spin.current) spin.current.rotation.y = clock.elapsedTime * 0.18;
    materials.current.forEach((mat, i) => mat?.color.set(activatedColor(SAMPLE_BEADS[i], uv.current)));
  });

  return (
    <group position={[-0.4, -0.5, 0.5]} rotation-x={0.42}>
      <group ref={spin}>
        {beads.map((slot, i) => (
          <RoundedBox
            key={SAMPLE_BEADS[i].id}
            args={[0.66, 0.66, 0.22]}
            radius={0.1}
            smoothness={5}
            position={[slot.x, slot.y, slot.z]}
            rotation-y={faceOutward(slot.angle)}
          >
            <meshPhysicalMaterial
              ref={(mat) => {
                materials.current[i] = mat;
              }}
              color="#f7f4ee"
              roughness={0.32}
              clearcoat={1}
              clearcoatRoughness={0.12}
            />
          </RoundedBox>
        ))}
        {spacers.map((slot) => (
          <mesh key={slot.angle} position={[slot.x, slot.y, slot.z]}>
            <sphereGeometry args={[0.1, 32, 32]} />
            <meshPhysicalMaterial color="#e9e2d6" roughness={0.2} clearcoat={1} />
          </mesh>
        ))}
        <mesh rotation-x={Math.PI / 2}>
          <torusGeometry args={[1.9, 0.018, 12, 200]} />
          <meshStandardMaterial color="#ffffff" roughness={0.3} transparent opacity={0.7} />
        </mesh>
      </group>
    </group>
  );
}

export default function R3FScene() {
  const readoutRef = useRef<HTMLSpanElement>(null);
  const [targetUv, setTargetUv] = useState(8);
  const [auto, setAuto] = useState(true);
  const control = useRef<Control>({ targetUv, auto });
  const uv = useRef(targetUv);
  useEffect(() => {
    control.current = { targetUv, auto };
  }, [targetUv, auto]);

  return (
    <div className="stage">
      {/* Canvas가 렌더러·장면·카메라·반복문·크기조절·정리를 전부 대신 해준다 */}
      <Canvas
        className="stage-mount"
        dpr={[1, 2]}
        camera={{ position: [0, 0.8, 9], fov: 35 }}
        gl={{ antialias: true, alpha: true }}
        onCreated={({ gl }) => {
          gl.toneMappingExposure = 1.1;
        }}
      >
        <UvDriver control={control} uv={uv} readout={readoutRef} />
        <RoomLight />
        <ambientLight intensity={0.25} color="#fff4e8" />
        <directionalLight position={[-3, 2, 6]} intensity={0.5} color="#fff1e0" />
        <Sun uv={uv} />
        <Bracelet uv={uv} />
        <OrbitControls enableZoom={false} enablePan={false} minPolarAngle={Math.PI * 0.3} maxPolarAngle={Math.PI * 0.62} />
      </Canvas>
      <UvPanel targetUv={targetUv} auto={auto} readoutRef={readoutRef} onTargetUv={setTargetUv} onAuto={setAuto} />
    </div>
  );
}
