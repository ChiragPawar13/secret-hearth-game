// AABB collision helper for the mansion walls.
// Kept in a plain module (not React) so both the controller and gameplay logic can share it.

export type AABB = { minX: number; maxX: number; minZ: number; maxZ: number };

// Mirrors the WALLS array in components/game/Mansion.tsx.
// Each entry: center (x,z) and full width/depth (w,d).
const WALL_DEFS: { x: number; z: number; w: number; d: number }[] = [
  { x: 0, z: -18, w: 36, d: 0.6 },
  { x: 0, z: 18, w: 36, d: 0.6 },
  { x: -18, z: 0, w: 0.6, d: 36 },
  { x: 18, z: 0, w: 0.6, d: 36 },
  { x: -10, z: -3, w: 8, d: 0.4 },
  { x: -10, z: 3, w: 8, d: 0.4 },
  { x: 10, z: -3, w: 8, d: 0.4 },
  { x: 10, z: 3, w: 8, d: 0.4 },
  { x: 0, z: -10, w: 0.4, d: 6 },
  { x: 0, z: 10, w: 0.4, d: 6 },
];

const RADIUS = 0.45;

export const WALL_AABBS: AABB[] = WALL_DEFS.map((w) => ({
  minX: w.x - w.w / 2,
  maxX: w.x + w.w / 2,
  minZ: w.z - w.d / 2,
  maxZ: w.z + w.d / 2,
}));

function collides(x: number, z: number): boolean {
  for (const b of WALL_AABBS) {
    if (
      x + RADIUS > b.minX &&
      x - RADIUS < b.maxX &&
      z + RADIUS > b.minZ &&
      z - RADIUS < b.maxZ
    ) {
      return true;
    }
  }
  return false;
}

// Slide movement: try both axes together, then each independently.
export function resolveMove(
  fromX: number,
  fromZ: number,
  dx: number,
  dz: number,
): { x: number; z: number } {
  let x = fromX + dx;
  let z = fromZ + dz;
  if (!collides(x, z)) return { x, z };
  // Try X only
  if (!collides(fromX + dx, fromZ)) return { x: fromX + dx, z: fromZ };
  // Try Z only
  if (!collides(fromX, fromZ + dz)) return { x: fromX, z: fromZ + dz };
  return { x: fromX, z: fromZ };
}
