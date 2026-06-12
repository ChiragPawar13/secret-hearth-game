import { useEffect, useRef, useState } from "react";

export type JoystickVec = { x: number; y: number };

/**
 * Touch joystick. Calls onMove with normalized [-1,1] vector while dragging.
 * Position: bottom-left of screen. Hidden on non-touch devices via prop.
 */
export function MobileJoystick({ onMove }: { onMove: (v: JoystickVec) => void }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const activeId = useRef<number | null>(null);
  const center = useRef({ x: 0, y: 0 });
  const RADIUS = 56;

  useEffect(() => {
    function onTouchStart(e: TouchEvent) {
      const el = wrapRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      for (const t of Array.from(e.changedTouches)) {
        if (
          t.clientX >= rect.left &&
          t.clientX <= rect.right &&
          t.clientY >= rect.top &&
          t.clientY <= rect.bottom
        ) {
          activeId.current = t.identifier;
          center.current = {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
          };
          e.preventDefault();
          break;
        }
      }
    }
    function onTouchMove(e: TouchEvent) {
      if (activeId.current === null) return;
      for (const t of Array.from(e.touches)) {
        if (t.identifier === activeId.current) {
          let dx = t.clientX - center.current.x;
          let dy = t.clientY - center.current.y;
          const len = Math.hypot(dx, dy);
          if (len > RADIUS) {
            dx = (dx / len) * RADIUS;
            dy = (dy / len) * RADIUS;
          }
          setKnob({ x: dx, y: dy });
          onMove({ x: dx / RADIUS, y: dy / RADIUS });
          e.preventDefault();
          break;
        }
      }
    }
    function onTouchEnd(e: TouchEvent) {
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === activeId.current) {
          activeId.current = null;
          setKnob({ x: 0, y: 0 });
          onMove({ x: 0, y: 0 });
          break;
        }
      }
    }
    window.addEventListener("touchstart", onTouchStart, { passive: false });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("touchcancel", onTouchEnd);
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [onMove]);

  return (
    <div
      ref={wrapRef}
      className="fixed bottom-6 left-6 z-40 touch-none select-none"
      style={{ width: 140, height: 140 }}
    >
      <div className="absolute inset-0 rounded-full border-2 border-white/20 bg-black/30 backdrop-blur-sm" />
      <div
        className="absolute rounded-full bg-white/80 shadow-lg"
        style={{
          width: 56,
          height: 56,
          left: 140 / 2 - 28 + knob.x,
          top: 140 / 2 - 28 + knob.y,
          transition: activeId.current === null ? "all 0.12s" : "none",
        }}
      />
    </div>
  );
}
