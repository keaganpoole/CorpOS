import { LOGO_PATHS } from './logoPresets';

// Draw the approved mark once. No animation clock or pointer listeners.
export function initializeLogo(root, { strokeWidth = 8 } = {}) {
  const lines = root.querySelector('[data-logo-lines], #lines');
  const bloom = root.querySelector('[data-logo-bloom], #bloom');
  const geometry = LOGO_PATHS.map(points => points.map(([x, y], index) =>
    `${index ? 'L' : 'M'}${260 + (x - 65) * 4.1} ${260 + (y - 58) * 4.1}`
  ).join(' ')).join(' ');
  const paths = [bloom, lines].map(parent => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', geometry);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', '#ffffff');
    path.setAttribute('stroke-width', String(strokeWidth));
    path.setAttribute('stroke-linejoin', 'miter');
    path.setAttribute('stroke-linecap', 'square');
    parent.append(path);
    return path;
  });
  return () => paths.forEach(path => path.remove());
}
