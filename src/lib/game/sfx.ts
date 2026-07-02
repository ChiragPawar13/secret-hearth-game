// Procedural sound effects via WebAudio. No assets required.
// All sounds are short and mono; safe to fire from anywhere on the client.

let ctx: AudioContext | null = null;
let ambientNode: { osc: OscillatorNode; gain: GainNode } | null = null;
let started = false;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

// Must be called from a user gesture on some browsers.
export function unlockAudio() {
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") c.resume().catch(() => {});
  if (!started) {
    started = true;
    startAmbient();
  }
}

function tone(opts: {
  freq: number;
  type?: OscillatorType;
  duration: number;
  gain?: number;
  attack?: number;
  release?: number;
  slideTo?: number;
}) {
  const c = getCtx();
  if (!c) return;
  const now = c.currentTime;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = opts.type ?? "sine";
  osc.frequency.setValueAtTime(opts.freq, now);
  if (opts.slideTo !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(0.0001, opts.slideTo),
      now + opts.duration,
    );
  }
  const peak = opts.gain ?? 0.2;
  const atk = opts.attack ?? 0.005;
  const rel = opts.release ?? 0.08;
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(peak, now + atk);
  g.gain.linearRampToValueAtTime(0, now + opts.duration + rel);
  osc.connect(g).connect(c.destination);
  osc.start(now);
  osc.stop(now + opts.duration + rel + 0.02);
}

function noise(opts: { duration: number; gain?: number; filterHz?: number }) {
  const c = getCtx();
  if (!c) return;
  const now = c.currentTime;
  const bufferSize = Math.max(1, Math.floor(c.sampleRate * opts.duration));
  const buf = c.createBuffer(1, bufferSize, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = opts.filterHz ?? 1200;
  const g = c.createGain();
  const peak = opts.gain ?? 0.15;
  g.gain.setValueAtTime(peak, now);
  g.gain.linearRampToValueAtTime(0, now + opts.duration);
  src.connect(filter).connect(g).connect(c.destination);
  src.start(now);
  src.stop(now + opts.duration + 0.02);
}

function startAmbient() {
  const c = getCtx();
  if (!c || ambientNode) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = "sawtooth";
  osc.frequency.value = 55;
  g.gain.value = 0.02;
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 220;
  osc.connect(lp).connect(g).connect(c.destination);
  osc.start();
  ambientNode = { osc, gain: g };
}

export const sfx = {
  unlock: unlockAudio,
  click: () => tone({ freq: 720, type: "square", duration: 0.04, gain: 0.08 }),
  taskDone: () => {
    tone({ freq: 660, type: "triangle", duration: 0.1, gain: 0.15 });
    setTimeout(
      () => tone({ freq: 990, type: "triangle", duration: 0.14, gain: 0.15 }),
      90,
    );
  },
  kill: () => {
    noise({ duration: 0.35, gain: 0.25, filterHz: 800 });
    tone({
      freq: 180,
      type: "sawtooth",
      duration: 0.5,
      slideTo: 40,
      gain: 0.25,
      release: 0.2,
    });
  },
  report: () => {
    // Emergency bell — three fast tones
    for (let i = 0; i < 4; i++) {
      setTimeout(
        () =>
          tone({
            freq: 880,
            type: "square",
            duration: 0.12,
            gain: 0.22,
          }),
        i * 140,
      );
    }
  },
  meetingStart: () => {
    tone({ freq: 220, type: "sawtooth", duration: 0.7, slideTo: 110, gain: 0.2 });
  },
  vent: () => {
    noise({ duration: 0.4, gain: 0.2, filterHz: 500 });
  },
  win: () => {
    [523, 659, 784, 1046].forEach((f, i) =>
      setTimeout(
        () => tone({ freq: f, type: "triangle", duration: 0.18, gain: 0.2 }),
        i * 110,
      ),
    );
  },
  lose: () => {
    [392, 330, 262, 196].forEach((f, i) =>
      setTimeout(
        () => tone({ freq: f, type: "sawtooth", duration: 0.22, gain: 0.2 }),
        i * 140,
      ),
    );
  },
  chat: () => tone({ freq: 520, type: "sine", duration: 0.05, gain: 0.08 }),
};
