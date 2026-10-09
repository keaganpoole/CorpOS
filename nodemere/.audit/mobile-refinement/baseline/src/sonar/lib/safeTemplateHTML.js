export const escapeHTML = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

// Escape literal text independently of generated chip markup. Unknown tokens
// remain literal text; callbacks must escape dynamic labels within their markup.
export function renderSafeTemplateHTML(value, { smart, variable }) {
  if (typeof value !== 'string') return '';
  const pattern = /\{\{([^}]+)\}\}|\{smart:([^}]+)\}/g;
  let result = '';
  let offset = 0;
  for (const match of value.matchAll(pattern)) {
    result += escapeHTML(value.slice(offset, match.index));
    const rendered = match[1] !== undefined
      ? variable(match[0], match[1])
      : smart(match[0], match[2]);
    result += rendered == null || rendered === match[0] ? escapeHTML(match[0]) : rendered;
    offset = match.index + match[0].length;
  }
  return result + escapeHTML(value.slice(offset));
}
