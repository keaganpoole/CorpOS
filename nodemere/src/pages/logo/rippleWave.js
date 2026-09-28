const AMPLITUDES = [1, .75, .55, .4];
const FREQUENCIES = [6, 7, 6, 8];
export const PRELOADER_SPEED = 1.8;
export const PRELOADER_PASS_SECONDS = Math.PI * 2 / PRELOADER_SPEED;

export function advanceRippleSpring(state, target, dt) {
  for (let step = 0; step < 4; step++) {
    state.velocity += ((target - state.amplitude) * 500 - state.velocity * 32) * dt / 4;
    state.amplitude += state.velocity * dt / 4;
  }
}

// Layer zero is white; the colored layers follow the same reference response.
export function rippleWave(progress, seconds, layer, distance, canvasSize, amplitude, profile = 'circle', radiusOverride) {
  const normalizedDistance = distance / canvasSize;
  const radius = radiusOverride ?? (profile === 'line' ? .16 : .13);
  const frequency = profile === 'line' ? 2.25 * [1, 1.12, .92, 1.28][layer] : FREQUENCIES[layer];
  const influence = Math.exp(-(normalizedDistance ** 2) / (2 * radius ** 2));
  const phase = Math.PI * 2 * frequency * progress + seconds * PRELOADER_SPEED * Math.PI * 2 + layer * .9;
  return amplitude * AMPLITUDES[layer] * influence * Math.sin(phase);
}
