import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

type Props = {
  label: string;
  color: string;
  onComplete: () => void;
  onCancel: () => void;
};

/**
 * Trivial click sequence minigame. Click the highlighted dot 5 times in order.
 */
export function TaskMinigame({ label, color, onComplete, onCancel }: Props) {
  const sequence = useMemo(() => {
    const arr = Array.from({ length: 9 }, (_, i) => i);
    // shuffle
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.slice(0, 5);
  }, []);
  const [step, setStep] = useState(0);

  function click(idx: number) {
    if (idx !== sequence[step]) return;
    if (step + 1 >= sequence.length) {
      onComplete();
    } else {
      setStep(step + 1);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-sm p-4">
      <div className="panel p-6 max-w-md w-full">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Task</p>
            <h2 className="font-display text-2xl" style={{ color }}>
              {label}
            </h2>
          </div>
          <div className="text-sm text-muted-foreground">
            {step}/{sequence.length}
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Press the glowing tile, in order.
        </p>
        <div className="grid grid-cols-3 gap-2 aspect-square">
          {Array.from({ length: 9 }).map((_, i) => {
            const active = i === sequence[step];
            return (
              <button
                key={i}
                onClick={() => click(i)}
                className="rounded-md border border-border transition-all active:scale-95"
                style={{
                  background: active ? color : "var(--color-secondary)",
                  boxShadow: active ? `0 0 18px ${color}` : "none",
                }}
              />
            );
          })}
        </div>
        <div className="mt-4 flex justify-end">
          <Button variant="ghost" onClick={onCancel}>
            Leave task
          </Button>
        </div>
      </div>
    </div>
  );
}
