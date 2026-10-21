/** Test helper: resolve SVG text font sizes after ancestor transforms and nested viewBox mapping. */
const parseAttrs = (source) => Object.fromEntries([...source.matchAll(/([:\w-]+)="([^"]*)"/gu)].map((match) => [match[1], match[2]]));
const multiply = (left, right) => [
  left[0] * right[0] + left[2] * right[1], left[1] * right[0] + left[3] * right[1],
  left[0] * right[2] + left[2] * right[3], left[1] * right[2] + left[3] * right[3],
  left[0] * right[4] + left[2] * right[5] + left[4], left[1] * right[4] + left[3] * right[5] + left[5],
];
const transformMatrix = (value = '') => {
  let matrix = [1, 0, 0, 1, 0, 0];
  for (const [, name, argsText] of value.matchAll(/([A-Za-z]+)\s*\(([^)]*)\)/gu)) {
    const args = argsText.trim().split(/[\s,]+/u).filter(Boolean).map(Number);
    if (args.some((arg) => !Number.isFinite(arg))) throw new Error(`invalid SVG transform: ${value}`);
    let next;
    if (name === 'matrix' && args.length === 6) next = args;
    else if (name === 'translate' && (args.length === 1 || args.length === 2)) next = [1, 0, 0, 1, args[0], args[1] ?? 0];
    else if (name === 'scale' && (args.length === 1 || args.length === 2)) next = [args[0], 0, 0, args[1] ?? args[0], 0, 0];
    else if (name === 'rotate' && (args.length === 1 || args.length === 3)) {
      const radians = args[0] * Math.PI / 180, cos = Math.cos(radians), sin = Math.sin(radians);
      next = [cos, sin, -sin, cos, 0, 0];
      if (args.length === 3) next = multiply(multiply([1, 0, 0, 1, args[1], args[2]], next), [1, 0, 0, 1, -args[1], -args[2]]);
    } else if (name === 'skewX' && args.length === 1) next = [1, 0, Math.tan(args[0] * Math.PI / 180), 1, 0, 0];
    else if (name === 'skewY' && args.length === 1) next = [1, Math.tan(args[0] * Math.PI / 180), 0, 1, 0, 0];
    else throw new Error(`unsupported SVG transform: ${name}`);
    matrix = multiply(matrix, next);
  }
  return matrix;
};
const viewBoxScale = (attrs) => {
  if (!attrs.viewBox) return [1, 0, 0, 1, 0, 0];
  const box = attrs.viewBox.trim().split(/[\s,]+/u).map(Number);
  const width = Number.parseFloat(attrs.width), height = Number.parseFloat(attrs.height);
  if (box.length !== 4 || box.some((value) => !Number.isFinite(value)) || box[2] <= 0 || box[3] <= 0 || !Number.isFinite(width) || !Number.isFinite(height)) {
    throw new Error(`cannot resolve SVG viewBox scale: ${JSON.stringify(attrs)}`);
  }
  const scaleX = width / box[2], scaleY = height / box[3];
  if (attrs.preserveAspectRatio?.trim().startsWith('none')) return [scaleX, 0, 0, scaleY, 0, 0];
  const scale = Math.min(scaleX, scaleY);
  return [scale, 0, 0, scale, 0, 0];
};

export function svgTextNodesWithEffectiveFontSize(svg) {
  const stack = [];
  const nodes = [];
  const tags = /<\/?([A-Za-z][\w:-]*)\b([^>]*)>/gu;
  for (const match of svg.matchAll(tags)) {
    const closing = match[0].startsWith('</');
    const name = match[1];
    if (closing) {
      const popped = stack.pop();
      if (!popped || popped.name !== name) throw new Error(`malformed SVG nesting at </${name}>`);
      continue;
    }
    const attrs = parseAttrs(match[2]);
    const parent = stack.at(-1) ?? { fontSize: null, matrix: [1, 0, 0, 1, 0, 0] };
    const transform = transformMatrix(attrs.transform);
    const matrix = multiply(multiply(parent.matrix, viewBoxScale(attrs)), transform);
    const fontRaw = attrs['font-size'] ?? parent.fontSize;
    let fontSize = null;
    if (fontRaw !== null) {
      const parsed = Number.parseFloat(fontRaw);
      if (!Number.isFinite(parsed) || !/^\s*[+-]?(?:\d+\.?\d*|\.\d+)(?:px)?\s*$/u.test(fontRaw)) throw new Error(`invalid or unsupported SVG font-size: ${fontRaw}`);
      fontSize = parsed;
    }
    const scaleY = Math.hypot(matrix[2], matrix[3]);
    if (name === 'text') {
      if (fontSize === null) throw new Error('SVG text node has no resolvable font-size');
      const start = match.index + match[0].length;
      const end = svg.indexOf('</text>', start);
      if (end < 0) throw new Error('unterminated SVG text node');
      const content = svg.slice(start, end).replace(/<[^>]*>/gu, '').replace(/&amp;/gu, '&').replace(/&lt;/gu, '<').replace(/&gt;/gu, '>').trim();
      nodes.push({ text: content, fontSize, effectiveFontSize: fontSize * scaleY, scaleY, attrs });
    }
    if (!/\/\s*>$/u.test(match[0])) stack.push({ name, fontSize, matrix });
  }
  return nodes;
}
