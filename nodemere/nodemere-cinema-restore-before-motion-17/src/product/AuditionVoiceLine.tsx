import { voicePath } from "../Waveform";

// IntercomVoiceLine.jsx's original four layers, spring and SVG treatment.
// Integrate a fictional RMS signal from the beginning on every seek. The product
// microphone / requestAnimationFrame transport is never imported into the film.
function simulatedSpeech(time: number) {
  let amplitude = 0,
    velocity = 0;
  const step = 1 / 120;
  const count = Math.max(0, Math.floor(time / step));
  for (let i = 0; i < count; i++) {
    const level =
      0.16 +
      0.08 * Math.sin(i * step * 8.8) +
      0.045 * Math.sin(i * step * 17.1);
    const target =
      0.45 +
      (15 - 0.45) *
        Math.pow(
          Math.min(1, Math.max(0, (level - 0.005) / (0.35 - 0.005))),
          0.58,
        );
    const attacking = target > amplitude;
    velocity +=
      ((target - amplitude) * (attacking ? 500 : 520) -
        velocity * (attacking ? 32 : 40)) *
      step;
    amplitude += velocity * step;
  }
  return amplitude;
}

export function AuditionVoiceLine({
  active,
  time,
  id,
}: {
  active: boolean;
  time: number;
  id: string;
}) {
  const amplitude = active ? simulatedSpeech(time) : 0;
  const phase = Math.max(0, time) * 1.8 * Math.PI * 2;
  const colors = ["#fff", `url(#${id}-a)`, `url(#${id}-b)`, `url(#${id}-a)`];
  return (
    <svg
      className="intercom-voice-line"
      viewBox="0 0 96 44"
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <linearGradient id={`${id}-a`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="42%" stopColor="#7c3aed" />
          <stop offset="58%" stopColor="#f45fd2" />
        </linearGradient>
        <linearGradient id={`${id}-b`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="42%" stopColor="#f45fd2" />
          <stop offset="58%" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
      {[true, false].map((glow) =>
        [3, 2, 1, 0].map((layer) => (
          <path
            key={`${glow}-${layer}`}
            d={
              amplitude ? voicePath(amplitude, phase, layer) : "M 4 22 L 92 22"
            }
            stroke={colors[layer]}
            className={glow ? "intercom-voice-line-glow" : undefined}
          />
        )),
      )}
    </svg>
  );
}
