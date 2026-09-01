/**
 * yaml-lite — a parser for the YAML subset used in SKILL.md front matter.
 *
 * Supports: scalars, quoted strings, inline `[a, b]` lists, block lists of
 * scalars, block lists of maps, and nesting by two-space indentation.
 *
 * Fail-loud by design: anything it does not understand throws rather than
 * being silently dropped. A front matter block that half-parses is worse than
 * one that fails.
 */

export function parseFrontMatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (!m) throw new Error('no YAML front matter found');
  return { data: parseYaml(m[1]), body: m[2] };
}

export function parseYaml(src) {
  const lines = src
    .split(/\r?\n/)
    .filter((l) => l.trim() !== '' && !/^\s*#/.test(l));
  const [value, next] = parseBlock(lines, 0, indentOf(lines[0] ?? ''));
  if (next !== lines.length) {
    throw new Error(`unparsed content at line ${next + 1}: ${lines[next]}`);
  }
  return value;
}

const indentOf = (line) => line.length - line.trimStart().length;

function parseBlock(lines, start, indent) {
  if (start >= lines.length) return [null, start];
  return lines[start].trim().startsWith('- ')
    ? parseList(lines, start, indent)
    : parseMap(lines, start, indent);
}

function parseMap(lines, start, indent) {
  const out = {};
  let i = start;
  while (i < lines.length) {
    const line = lines[i];
    const ind = indentOf(line);
    if (ind < indent) break;
    if (ind > indent) throw new Error(`unexpected indentation at line ${i + 1}: ${line}`);

    const trimmed = line.trim();
    if (trimmed.startsWith('- ')) break;

    const sep = trimmed.indexOf(':');
    if (sep === -1) throw new Error(`expected "key: value" at line ${i + 1}: ${line}`);
    const key = trimmed.slice(0, sep).trim();
    const rest = trimmed.slice(sep + 1).trim();

    if (rest !== '') {
      out[key] = scalar(rest);
      i += 1;
      continue;
    }

    const childIndent = i + 1 < lines.length ? indentOf(lines[i + 1]) : indent;
    if (i + 1 >= lines.length || childIndent <= indent) {
      out[key] = null;
      i += 1;
      continue;
    }
    const [value, next] = parseBlock(lines, i + 1, childIndent);
    out[key] = value;
    i = next;
  }
  return [out, i];
}

function parseList(lines, start, indent) {
  const out = [];
  let i = start;
  while (i < lines.length) {
    const line = lines[i];
    const ind = indentOf(line);
    if (ind < indent) break;
    const trimmed = line.trim();
    if (!trimmed.startsWith('- ')) break;

    const rest = trimmed.slice(2).trim();
    if (rest.includes(': ') || rest.endsWith(':')) {
      // A list of maps: re-parse this item's key plus any following indented keys.
      const itemIndent = ind + 2;
      const synthetic = [' '.repeat(itemIndent) + rest];
      let j = i + 1;
      while (j < lines.length && indentOf(lines[j]) >= itemIndent && !lines[j].trim().startsWith('- ')) {
        synthetic.push(lines[j]);
        j += 1;
      }
      const [value] = parseMap(synthetic, 0, itemIndent);
      out.push(value);
      i = j;
    } else {
      out.push(scalar(rest));
      i += 1;
    }
  }
  return [out, i];
}

function scalar(raw) {
  const s = raw.trim();
  if (s.startsWith('[') && s.endsWith(']')) {
    const inner = s.slice(1, -1).trim();
    return inner === '' ? [] : inner.split(',').map((v) => scalar(v));
  }
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (s === 'null' || s === '~') return null;
  if (/^-?\d+$/.test(s)) return Number(s);
  return s;
}
