import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import { Mansion, MANSION_BOUNDS, TASK_POSITIONS, VENT_POSITIONS } from "./Mansion";
import { resolveMove } from "@/lib/game/collision";
import type { Tables } from "@/integrations/supabase/types";

export type RemoteTransform = {
  x: number;
  z: number;
  rotY: number;
};

export type PlayerView = {
  id: string;
  userId: string;
  displayName: string;
  color: string;
  isAlive: boolean;
  role: string | null;
  posX: number;
  posZ: number;
  rotY: number;
};

type Props = {
  players: PlayerView[];
  myUserId: string;
  remoteTransformsRef: React.MutableRefObject<Map<string, RemoteTransform>>;
  inputRef: React.MutableRefObject<{ x: number; y: number; sprint: boolean }>;
  myPosRef: React.MutableRefObject<{ x: number; z: number; rotY: number }>;
  paused: boolean;
};

const SPEED = 4.5;
const SPRINT_SPEED = 7;

function LocalPlayer({
  color,
  isAlive,
  inputRef,
  myPosRef,
  paused,
}: {
  color: string;
  isAlive: boolean;
  inputRef: Props["inputRef"];
  myPosRef: Props["myPosRef"];
  paused: boolean;
}) {
  const meshRef = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const yaw = useRef(0);
  const camOffset = useMemo(() => new THREE.Vector3(0, 6, 8), []);

  // Listen for external teleport (vent) events dispatched by game route.
  useEffect(() => {
    function onTeleport(e: Event) {
      const detail = (e as CustomEvent<{ x: number; z: number }>).detail;
      if (!detail || !meshRef.current) return;
      meshRef.current.position.x = detail.x;
      meshRef.current.position.z = detail.z;
      myPosRef.current.x = detail.x;
      myPosRef.current.z = detail.z;
    }
    window.addEventListener("para:teleport", onTeleport as EventListener);
    return () => window.removeEventListener("para:teleport", onTeleport as EventListener);
  }, [myPosRef]);

  useFrame((_state, delta) => {
    if (!meshRef.current) return;
    const dt = Math.min(delta, 0.05);

    if (!paused && isAlive) {
      const inp = inputRef.current;
      const len = Math.hypot(inp.x, inp.y);
      if (len > 0.05) {
        // Movement relative to camera yaw
        const speed = inp.sprint ? SPRINT_SPEED : SPEED;
        const forward = new THREE.Vector3(0, 0, 1).applyAxisAngle(
          new THREE.Vector3(0, 1, 0),
          yaw.current,
        );
        const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(
          new THREE.Vector3(0, 1, 0),
          yaw.current,
        );
        const dir = new THREE.Vector3()
          .addScaledVector(right, inp.x)
          .addScaledVector(forward, inp.y);
        dir.normalize().multiplyScalar(speed * dt);
        const resolved = resolveMove(
          meshRef.current.position.x,
          meshRef.current.position.z,
          dir.x,
          dir.z,
        );
        meshRef.current.position.x = THREE.MathUtils.clamp(
          resolved.x,
          -MANSION_BOUNDS + 1,
          MANSION_BOUNDS - 1,
        );
        meshRef.current.position.z = THREE.MathUtils.clamp(
          resolved.z,
          -MANSION_BOUNDS + 1,
          MANSION_BOUNDS - 1,
        );
        // Face movement direction
        const targetYaw = Math.atan2(dir.x, dir.z);
        meshRef.current.rotation.y = targetYaw;
        myPosRef.current.rotY = targetYaw;
      }
      myPosRef.current.x = meshRef.current.position.x;
      myPosRef.current.z = meshRef.current.position.z;
    }

    // Camera follow
    const targetCamPos = new THREE.Vector3(
      meshRef.current.position.x - Math.sin(yaw.current) * camOffset.z,
      camOffset.y,
      meshRef.current.position.z - Math.cos(yaw.current) * camOffset.z,
    );
    camera.position.lerp(targetCamPos, 1 - Math.pow(0.001, dt));
    camera.lookAt(
      meshRef.current.position.x,
      meshRef.current.position.y + 1,
      meshRef.current.position.z,
    );
  });

  // Mouse drag yaw on desktop
  useEffect(() => {
    let dragging = false;
    let lastX = 0;
    function onDown(e: PointerEvent) {
      if (e.target instanceof HTMLElement && e.target.closest("[data-hud]")) return;
      dragging = true;
      lastX = e.clientX;
    }
    function onMove(e: PointerEvent) {
      if (!dragging) return;
      yaw.current -= (e.clientX - lastX) * 0.005;
      lastX = e.clientX;
    }
    function onUp() {
      dragging = false;
    }
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  return (
    <group ref={meshRef} position={[myPosRef.current.x, 0, myPosRef.current.z]}>
      <mesh castShadow position={[0, 0.9, 0]}>
        <capsuleGeometry args={[0.4, 1, 8, 16]} />
        <meshStandardMaterial
          color={isAlive ? color : "#444"}
          emissive={isAlive ? color : "#000"}
          emissiveIntensity={0.15}
          roughness={0.5}
        />
      </mesh>
      <mesh position={[0, 1.7, 0.32]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshBasicMaterial color="#fff" />
      </mesh>
    </group>
  );
}

function RemotePlayer({
  player,
  transformsRef,
}: {
  player: PlayerView;
  transformsRef: Props["remoteTransformsRef"];
}) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((_s, delta) => {
    if (!groupRef.current) return;
    const t = transformsRef.current.get(player.userId);
    const tx = t?.x ?? player.posX;
    const tz = t?.z ?? player.posZ;
    const ry = t?.rotY ?? player.rotY;
    const k = 1 - Math.pow(0.0001, Math.min(delta, 0.05));
    groupRef.current.position.x += (tx - groupRef.current.position.x) * k;
    groupRef.current.position.z += (tz - groupRef.current.position.z) * k;
    // Lerp rotation along shortest path
    let dr = ry - groupRef.current.rotation.y;
    while (dr > Math.PI) dr -= Math.PI * 2;
    while (dr < -Math.PI) dr += Math.PI * 2;
    groupRef.current.rotation.y += dr * k;
  });

  if (!player.isAlive) {
    // Dead body — lying down
    return (
      <group position={[player.posX, 0, player.posZ]} rotation={[0, player.rotY, 0]}>
        <mesh position={[0, 0.25, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <capsuleGeometry args={[0.4, 1, 8, 16]} />
          <meshStandardMaterial color={player.color} roughness={0.7} />
        </mesh>
        {/* Blood pool */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0.6, 0.01, 0]}>
          <circleGeometry args={[0.9, 24]} />
          <meshBasicMaterial color="#5c0a0a" transparent opacity={0.85} />
        </mesh>
      </group>
    );
  }

  return (
    <group ref={groupRef} position={[player.posX, 0, player.posZ]} rotation={[0, player.rotY, 0]}>
      <mesh castShadow position={[0, 0.9, 0]}>
        <capsuleGeometry args={[0.4, 1, 8, 16]} />
        <meshStandardMaterial color={player.color} roughness={0.5} />
      </mesh>
      <mesh position={[0, 1.7, 0.32]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshBasicMaterial color="#fff" />
      </mesh>
      <Text
        position={[0, 2.3, 0]}
        fontSize={0.32}
        color="#fff"
        outlineWidth={0.02}
        outlineColor="#000"
        anchorX="center"
        anchorY="middle"
      >
        {player.displayName}
      </Text>
    </group>
  );
}

export function Scene3D({
  players,
  myUserId,
  remoteTransformsRef,
  inputRef,
  myPosRef,
  paused,
}: Props) {
  const me = players.find((p) => p.userId === myUserId);
  const others = players.filter((p) => p.userId !== myUserId);

  return (
    <Canvas
      shadows
      camera={{ position: [0, 6, 8], fov: 60, near: 0.1, far: 200 }}
      dpr={[1, 1.75]}
      gl={{ antialias: true }}
      style={{ position: "absolute", inset: 0, touchAction: "none" }}
    >
      <color attach="background" args={["#08070a"]} />
      <fog attach="fog" args={["#08070a", 14, 38]} />

      <ambientLight intensity={0.35} color="#5a4a6e" />
      <directionalLight
        position={[10, 20, 6]}
        intensity={0.6}
        color="#a09bff"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />

      <Mansion />

      {me && (
        <LocalPlayer
          color={me.color}
          isAlive={me.isAlive}
          inputRef={inputRef}
          myPosRef={myPosRef}
          paused={paused}
        />
      )}

      {others.map((p) => (
        <RemotePlayer key={p.id} player={p} transformsRef={remoteTransformsRef} />
      ))}
    </Canvas>
  );
}

// Re-export task positions for HUD logic
export { TASK_POSITIONS };

// Helper for game.$code.tsx
export function mapToPlayerView(p: Tables<"room_players">): PlayerView {
  return {
    id: p.id,
    userId: p.user_id,
    displayName: p.display_name,
    color: p.color,
    isAlive: p.is_alive,
    role: p.role,
    posX: p.pos_x,
    posZ: p.pos_z,
    rotY: p.rot_y,
  };
}
