export const PLAYER_COLORS = [
  "#ef4444", // red
  "#3b82f6", // blue
  "#10b981", // green
  "#f59e0b", // amber
  "#a855f7", // purple
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#84cc16", // lime
  "#f97316", // orange
  "#6366f1", // indigo
  "#14b8a6", // teal
  "#eab308", // yellow
] as const;

export type PlayerColor = (typeof PLAYER_COLORS)[number];
