const LAYERS = [
  { color: '#ffffff', amplitude: 1, frequency: 1 },
  { color: 'url(#intercom-purple-pink-gradient)', amplitude: 0.75, frequency: 1.12 },
  { color: 'url(#intercom-pink-purple-gradient)', amplitude: 0.55, frequency: 0.92 },
  { color: 'url(#intercom-pink-purple-gradient-reverse)', amplitude: 0.4, frequency: 1.28 },
];
const FLAT_PATH = 'M 4 22 L 92 22';
const MAX_AMPLITUDE = 15;

function wavePath(amplitude, phase, layerIndex) {
  const layer = LAYERS[layerIndex];
  const points = [];
  for (let index = 0; index <= 150; index += 1) {
    const position = index / 150;
    const distance = position - 0.5;
    const envelope = Math.exp(-(distance * distance) / (2 * 0.16 ** 2));
    const edge = Math.min(1, Math.min(position, 1 - position) / 0.08);
    const taper = edge * edge * (3 - 2 * edge);
    const wave = Math.sin(2 * Math.PI * 2.25 * layer.frequency * position + phase + layerIndex * 0.9);
    const y = 22 + amplitude * layer.amplitude * envelope * taper * wave;
    points.push(`${index === 0 ? 'M' : 'L'} ${(4 + 88 * position).toFixed(2)} ${y.toFixed(2)}`);
  }
  return points.join(' ');
}


export {LAYERS,wavePath,FLAT_PATH,MAX_AMPLITUDE};
