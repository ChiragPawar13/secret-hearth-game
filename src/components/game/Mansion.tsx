import { useMemo } from "react";
import * as THREE from "three";

export const MANSION_BOUNDS = 18; // half-extent on x and z
export const TASK_POSITIONS: { id: string; label: string; x: number; z: number; color: string }[] = [
  { id: "library", label: "Library", x: -12, z: -12, color: "#8b5e3c" },
  { id: "kitchen", label: "Kitchen", x: 12, z: -12, color: "#a3a3a3" },
  { id: "ballroom", label: "Ballroom", x: -12, z: 12, color: "#7c5cad" },
  { id: "cellar", label: "Cellar", x: 12, z: 12, color: "#5e2b2b" },
];

// Secret vents — only the murderer can use them, teleporting between paired locations.
export const VENT_POSITIONS: { id: string; x: number; z: number }[] = [
  { id: "v-lib", x: -15, z: -15 },
  { id: "v-kit", x: 15, z: -15 },
  { id: "v-ball", x: -15, z: 15 },
  { id: "v-cel", x: 15, z: 15 },
];

const WALLS: { x: number; z: number; w: number; d: number; h: number }[] = [
  // Perimeter
  { x: 0, z: -MANSION_BOUNDS, w: MANSION_BOUNDS * 2, d: 0.6, h: 3 },
  { x: 0, z: MANSION_BOUNDS, w: MANSION_BOUNDS * 2, d: 0.6, h: 3 },
  { x: -MANSION_BOUNDS, z: 0, w: 0.6, d: MANSION_BOUNDS * 2, h: 3 },
  { x: MANSION_BOUNDS, z: 0, w: 0.6, d: MANSION_BOUNDS * 2, h: 3 },
  // Interior partitions with doorways
  { x: -10, z: -3, w: 8, d: 0.4, h: 2.6 },
  { x: -10, z: 3, w: 8, d: 0.4, h: 2.6 },
  { x: 10, z: -3, w: 8, d: 0.4, h: 2.6 },
  { x: 10, z: 3, w: 8, d: 0.4, h: 2.6 },
  { x: 0, z: -10, w: 0.4, d: 6, h: 2.6 },
  { x: 0, z: 10, w: 0.4, d: 6, h: 2.6 },
];

const PROPS: { x: number; z: number; w: number; d: number; h: number; color: string }[] = [
  { x: -12, z: -10, w: 3, d: 1.2, h: 1.2, color: "#5a3a22" }, // library shelf
  { x: 12, z: -10, w: 2.5, d: 1.5, h: 1, color: "#666" }, // kitchen counter
  { x: -12, z: 14, w: 1.2, d: 1.2, h: 0.8, color: "#3a2a4d" }, // ballroom piano
  { x: 12, z: 14, w: 1.6, d: 1.6, h: 1.2, color: "#3a1c1c" }, // cellar barrel
  { x: 0, z: 0, w: 4, d: 4, h: 0.2, color: "#2a2027" }, // central rug
];

export function Mansion() {
  const wallMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#2c2630", roughness: 0.95 }),
    [],
  );
  const floorMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#1a1620", roughness: 1 }),
    [],
  );

  return (
    <group>
      {/* Floor */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[MANSION_BOUNDS * 2.4, MANSION_BOUNDS * 2.4]} />
        <primitive object={floorMat} attach="material" />
      </mesh>

      {/* Walls */}
      {WALLS.map((w, i) => (
        <mesh
          key={i}
          castShadow
          receiveShadow
          position={[w.x, w.h / 2, w.z]}
          material={wallMat}
        >
          <boxGeometry args={[w.w, w.h, w.d]} />
        </mesh>
      ))}

      {/* Props */}
      {PROPS.map((p, i) => (
        <mesh key={i} castShadow position={[p.x, p.h / 2, p.z]}>
          <boxGeometry args={[p.w, p.h, p.d]} />
          <meshStandardMaterial color={p.color} roughness={0.8} />
        </mesh>
      ))}

      {/* Task pads */}
      {TASK_POSITIONS.map((t) => (
        <group key={t.id} position={[t.x, 0, t.z]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
            <ringGeometry args={[1.4, 1.7, 32]} />
            <meshBasicMaterial color={t.color} transparent opacity={0.6} />
          </mesh>
          <mesh position={[0, 0.6, 0]}>
            <cylinderGeometry args={[0.35, 0.35, 1.2, 16]} />
            <meshStandardMaterial color={t.color} emissive={t.color} emissiveIntensity={0.4} />
          </mesh>
        </group>
      ))}

      {/* Vent grates */}
      {VENT_POSITIONS.map((v) => (
        <group key={v.id} position={[v.x, 0, v.z]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
            <ringGeometry args={[0.5, 0.75, 24]} />
            <meshBasicMaterial color="#1a0a0a" />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
            <circleGeometry args={[0.5, 24]} />
            <meshStandardMaterial color="#0d0508" emissive="#3a0000" emissiveIntensity={0.4} />
          </mesh>
        </group>
      ))}

      {/* Ambient lights inside rooms */}
      {TASK_POSITIONS.map((t) => (
        <pointLight
          key={`l-${t.id}`}
          position={[t.x, 2.4, t.z]}
          intensity={6}
          distance={9}
          color={t.color}
        />
      ))}
    </group>
  );
}
