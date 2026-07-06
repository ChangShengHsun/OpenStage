import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { PerspectiveCamera } from 'three';
import { useEditor } from '../state/store';
import { posesAtTime } from '../state/interpolate';
import type { StagePose } from '../state/interpolate';
import { useT } from '../i18n';

/**
 * 3D preview — generated live from the 2D coordinates, not an editing
 * surface. Stage meters map to three units: x stays x, stage y (downstage)
 * becomes +z, height is y. rotation 0 = facing the audience (+z).
 */

type CameraPreset = 'audience' | 'overhead' | 'side';

interface CamState {
  kind: CameraPreset;
  /** Bumped on every click so re-picking the same preset re-frames the view. */
  nonce: number;
}

/** Camera position + look-at for a preset, in three world units (stage centered at origin). */
function presetCamera(
  kind: CameraPreset,
  w: number,
  h: number,
): { pos: [number, number, number]; target: [number, number, number] } {
  switch (kind) {
    case 'overhead':
      return { pos: [0, Math.max(w, h) * 1.4 + 6, 0.001], target: [0, 0, 0] };
    case 'side':
      return { pos: [-(w * 1.1 + 4), h * 0.5 + 2, 0], target: [0, 0, 0] };
    case 'audience':
      return { pos: [0, h * 0.6 + 2, h * 1.1 + 4], target: [0, 0, 0] };
  }
}

function Controls({
  cam,
  w,
  h,
  followPose,
}: {
  cam: CamState;
  w: number;
  h: number;
  followPose: StagePose | null;
}): null {
  const { camera, gl } = useThree();
  const controlsRef = useRef<OrbitControls | null>(null);
  if (controlsRef.current === null) {
    const controls = new OrbitControls(camera as PerspectiveCamera, gl.domElement);
    controls.maxPolarAngle = Math.PI / 2.05; // don't go under the floor
    controlsRef.current = controls;
  }
  // Snap to the chosen preset (also runs on mount for the default framing).
  useEffect(() => {
    const controls = controlsRef.current;
    if (controls === null || followPose !== null) return;
    const { pos, target } = presetCamera(cam.kind, w, h);
    camera.position.set(pos[0], pos[1], pos[2]);
    controls.target.set(target[0], target[1], target[2]);
    controls.update();
  }, [cam.nonce, cam.kind, camera, w, h, followPose]);

  useFrame(() => {
    const controls = controlsRef.current;
    if (controls === null) return;
    if (followPose !== null) {
      // Chase cam: behind the dancer relative to WHERE THEY FACE and above,
      // looking the way they look — so as the dancer turns, the camera orbits
      // to stay at their back. World pos accounts for the stage-center group
      // offset. Facing vector matches Performer3D: dir = (cos, sin) of
      // (rotation + 90)°, so rotation 0 (facing audience) points +z downstage.
      const px = followPose.x - w / 2;
      const pz = followPose.y - h / 2;
      const facingRad = ((followPose.rotation + 90) * Math.PI) / 180;
      const fx = Math.cos(facingRad);
      const fz = Math.sin(facingRad);
      controls.enabled = false;
      camera.position.set(px - fx * 3, 2.4, pz - fz * 3);
      camera.lookAt(px + fx * 3, 1, pz + fz * 3);
    } else {
      controls.enabled = true;
      controls.update();
    }
  });
  return null;
}

function Performer3D({ pose, color }: { pose: StagePose; color: string }): ReactElement {
  const facingRad = ((pose.rotation + 90) * Math.PI) / 180;
  return (
    <group position={[pose.x, 0, pose.y]}>
      <mesh position={[0, 0.85, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.28, 1.7, 12]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* facing indicator: a short bar pointing where they look */}
      <mesh
        position={[Math.cos(facingRad) * 0.35, 1.35, Math.sin(facingRad) * 0.35]}
        rotation={[0, Math.PI / 2 - facingRad, 0]}
      >
        <boxGeometry args={[0.08, 0.08, 0.36]} />
        <meshStandardMaterial color="#ece5db" />
      </mesh>
    </group>
  );
}

export default function Stage3D(): ReactElement {
  const t = useT();
  const performance = useEditor((s) => s.performance);
  const performers = useEditor((s) => s.performers);
  const formations = useEditor((s) => s.formations);
  const positions = useEditor((s) => s.positions);
  const selectedFormationId = useEditor((s) => s.selectedFormationId);
  const isPlaying = useEditor((s) => s.isPlaying);
  const playheadMs = useEditor((s) => s.playheadMs);
  const [cam, setCam] = useState<CamState>({ kind: 'audience', nonce: 0 });
  const [followId, setFollowId] = useState<string | null>(null);
  const pickCam = (kind: CameraPreset): void => {
    setFollowId(null); // picking a fixed view leaves follow mode
    setCam((c) => ({ kind, nonce: c.nonce + 1 }));
  };

  const { stageWidth: w, stageHeight: h } = performance;

  const poses = useMemo(() => {
    if (isPlaying) return posesAtTime(formations, positions, playheadMs);
    const edit = positions[selectedFormationId] ?? {};
    const map = new Map<string, StagePose>();
    for (const [pid, pos] of Object.entries(edit)) {
      map.set(pid, { x: pos.x, y: pos.y, rotation: pos.rotation });
    }
    return map;
  }, [isPlaying, playheadMs, formations, positions, selectedFormationId]);

  return (
    <>
      <div className="cam-presets" role="group" aria-label={t.stage.cameraLabel}>
        <button type="button" className="btn" onClick={() => pickCam('audience')}>
          {t.stage.camAudience}
        </button>
        <button type="button" className="btn" onClick={() => pickCam('overhead')}>
          {t.stage.camOverhead}
        </button>
        <button type="button" className="btn" onClick={() => pickCam('side')}>
          {t.stage.camSide}
        </button>
        <select
          aria-label={t.stage.followLabel}
          value={followId ?? ''}
          style={{ width: 128 }}
          onChange={(e) => setFollowId(e.target.value === '' ? null : e.target.value)}
        >
          <option value="">{t.stage.followNone}</option>
          {performers.map((p) => (
            <option key={p.id} value={p.id}>
              {t.stage.followPrefix} {p.name}
            </option>
          ))}
        </select>
      </div>
      <Canvas
        shadows
        camera={{ position: [0, h * 0.9 + 3, h * 1.1 + 4], fov: 50 }}
        style={{ position: 'absolute', inset: 0, background: '#191512' }}
      >
        <Controls
          cam={cam}
          w={w}
          h={h}
          followPose={followId !== null ? (poses.get(followId) ?? null) : null}
        />
      <ambientLight intensity={0.55} />
      {/* the tungsten wash from above-front */}
      <directionalLight position={[2, 10, 8]} intensity={1.2} color="#e8c896" castShadow />

      {/* Everything positioned relative to stage center. */}
      <group position={[-w / 2, 0, -h / 2]}>
        {/* floor */}
        <mesh position={[w / 2, -0.05, h / 2]} receiveShadow>
          <boxGeometry args={[w, 0.1, h]} />
          <meshStandardMaterial color="#2e2a26" />
        </mesh>
        {/* downstage edge marker (audience side) */}
        <mesh position={[w / 2, 0.02, h + 0.15]}>
          <boxGeometry args={[w, 0.02, 0.08]} />
          <meshStandardMaterial color="#e8a84c" emissive="#e8a84c" emissiveIntensity={0.4} />
        </mesh>
        {/* center line spike, matching the 2D canvas */}
        <mesh position={[w / 2, 0.02, h / 2]}>
          <boxGeometry args={[0.02, 0.02, h]} />
          <meshStandardMaterial color="#e8d44c" transparent opacity={0.35} />
        </mesh>
        {performers.map((p) => {
          const pose = poses.get(p.id);
          if (pose === undefined) return null;
          return <Performer3D key={p.id} pose={pose} color={p.color} />;
        })}
      </group>
      </Canvas>
    </>
  );
}
