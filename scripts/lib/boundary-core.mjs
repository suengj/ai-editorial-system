/**
 * Boundary core — AES-P0.1 (SUE-434).
 *
 * Enforces the "Never committed" section of
 * docs/architecture/REPOSITORY-CONTRACT.md.
 *
 * Fail-closed: an unreadable or undecidable file is a violation, not a pass.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, posix, relative, sep } from 'node:path';

export const RULES = Object.freeze({
  SECRET: 'secret',
  SOURCE_CORPUS: 'source-corpus',
  PRIVATE_RESEARCH: 'private-research',
  ARTICLE_ARCHIVE: 'article-archive',
  LARGE_BINARY: 'large-binary',
  UNREADABLE: 'unreadable',
});

export const DEFAULT_LIMITS = Object.freeze({
  maxFileBytes: 2 * 1024 * 1024,
  maxImageBytes: 512 * 1024,
});

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.bmp', '.tiff', '.ico']);

const BINARY_EXT = new Set([
  '.mp4', '.mov', '.webm', '.mkv', '.avi',
  '.mp3', '.wav', '.m4a', '.flac', '.aac',
  '.pptx', '.key', '.pdf', '.zip', '.tar', '.gz', '.7z',
  ...IMAGE_EXT,
]);

/** Filenames/extensions that indicate a raw source corpus. */
const CORPUS_EXT = new Set(['.vtt', '.srt', '.sbv']);
const CORPUS_PATH_RE = /(^|\/)(transcripts?|corpus|youtube-corpus|raw)(\/|$)/i;
const CORPUS_NAME_RE = /\.(transcript|captions)\./i;

/** Filename markers for private/working material. */
const PRIVATE_PATH_RE = /(^|\/)(private|_private|internal|working|scratch|drafts)(\/|$)/i;
const PRIVATE_NAME_RE = /\.(private|internal|confidential)\./i;

/** In-content markers. Word-boundaried to avoid matching policy prose. */
const PRIVATE_CONTENT_RE = /^\s*(?:#\s*)?(?:classification|visibility|confidentiality)\s*:\s*(confidential|private|internal-only|internal only)\s*$/im;

/**
 * Secret detectors. Each entry must be specific enough that documenting the
 * rule does not trip the rule.
 */
const SECRET_RES = [
  { id: 'private-key-block', re: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/ },
  { id: 'aws-access-key-id', re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/ },
  { id: 'github-token', re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/ },
  { id: 'slack-token', re: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/ },
  { id: 'google-api-key', re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { id: 'anthropic-api-key', re: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/ },
  { id: 'openai-api-key', re: /\bsk-(?:proj-)?[A-Za-z0-9]{32,}\b/ },
  { id: 'generic-assigned-secret', re: /\b(?:api[_-]?key|secret[_-]?key|access[_-]?token|client[_-]?secret|password)\b\s*[:=]\s*["']?[A-Za-z0-9/+_-]{16,}["']?/i },
];

const SECRET_FILENAME_RE = /(^|\/)(\.env(\..+)?|credentials\.json|client_secret.*\.json|service-account.*\.json|token\.json)$/i;

/** An article archive entry: publishable front matter belonging to suengj-com. */
const FRONT_MATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---/;
const ARCHIVE_TYPE_RE = /^\s*type\s*:\s*(note|research|view|project|editorial)\s*$/im;
const ARCHIVE_STATUS_RE = /^\s*status\s*:\s*(published|archived|draft)\s*$/im;

const DEFAULT_SKIP_DIRS = new Set(['.git', 'node_modules', '.cache', 'coverage', 'dist', 'build']);

/** Text extensions we are willing to decode and scan. */
const TEXT_EXT = new Set([
  '.md', '.mdx', '.txt', '.json', '.yaml', '.yml', '.toml', '.js', '.mjs',
  '.cjs', '.ts', '.tsx', '.jsx', '.sh', '.py', '.html', '.css', '.csv',
  '.env', '.example', '.vtt', '.srt', '.sbv', '',
]);

function toPosix(p) {
  return p.split(sep).join(posix.sep);
}

/**
 * Recursively list files under `root`, skipping infrastructure dirs and any
 * caller-supplied exclusions (relative posix paths).
 */
export function listFiles(root, { skipDirs = DEFAULT_SKIP_DIRS, exclude = [] } = {}) {
  const excluded = new Set(exclude);
  const out = [];

  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const abs = join(dir, entry.name);
      const rel = toPosix(relative(root, abs));
      if (excluded.has(rel)) continue;
      if (entry.isDirectory()) {
        if (skipDirs.has(entry.name)) continue;
        walk(abs);
      } else if (entry.isFile()) {
        out.push(rel);
      }
    }
  };

  walk(root);
  return out.sort();
}

function violation(rule, file, detail) {
  return { rule, file, detail };
}

/**
 * Check one file. `read` returns { bytes, text|null }.
 * Returns an array of violations (possibly empty).
 */
export function checkFile(rel, read, limits = DEFAULT_LIMITS) {
  const found = [];
  const ext = extname(rel).toLowerCase();

  if (SECRET_FILENAME_RE.test(rel) && !rel.endsWith('.example')) {
    found.push(violation(RULES.SECRET, rel, 'credential file name'));
  }

  if (CORPUS_EXT.has(ext) || CORPUS_PATH_RE.test(rel) || CORPUS_NAME_RE.test(rel)) {
    found.push(violation(RULES.SOURCE_CORPUS, rel, 'raw source corpus path or extension'));
  }

  if (PRIVATE_PATH_RE.test(rel) || PRIVATE_NAME_RE.test(rel)) {
    found.push(violation(RULES.PRIVATE_RESEARCH, rel, 'private/working material path'));
  }

  let payload;
  try {
    payload = read();
  } catch (err) {
    // Fail closed: we could not prove the file is clean.
    return [...found, violation(RULES.UNREADABLE, rel, `unreadable: ${err.message}`)];
  }

  const { bytes, text } = payload;

  const ceiling = IMAGE_EXT.has(ext) ? limits.maxImageBytes : limits.maxFileBytes;
  if (BINARY_EXT.has(ext) && bytes > ceiling) {
    found.push(violation(RULES.LARGE_BINARY, rel, `${bytes} bytes exceeds ${ceiling}`));
  }

  if (text === null) {
    // Binary or undecodable. Size rule above is the only check that applies.
    if (!BINARY_EXT.has(ext) && !TEXT_EXT.has(ext)) {
      found.push(violation(RULES.UNREADABLE, rel, 'undecodable file of unrecognised type'));
    }
    return found;
  }

  for (const { id, re } of SECRET_RES) {
    if (re.test(text)) {
      found.push(violation(RULES.SECRET, rel, `matched ${id}`));
      break;
    }
  }

  if (PRIVATE_CONTENT_RE.test(text)) {
    found.push(violation(RULES.PRIVATE_RESEARCH, rel, 'confidential/private classification marker'));
  }

  if (ext === '.md' || ext === '.mdx') {
    const fm = FRONT_MATTER_RE.exec(text);
    if (fm && ARCHIVE_TYPE_RE.test(fm[1]) && ARCHIVE_STATUS_RE.test(fm[1])) {
      found.push(violation(
        RULES.ARTICLE_ARCHIVE,
        rel,
        'suengj-com publishable front matter (type + status) — articles belong in suengj-com',
      ));
    }
  }

  return found;
}

/** Scan a directory tree. Returns { files, violations }. */
export function scan(root, options = {}) {
  const { limits = DEFAULT_LIMITS, exclude = [] } = options;
  const files = listFiles(root, { exclude });
  const violations = [];

  for (const rel of files) {
    const abs = join(root, rel);
    violations.push(...checkFile(rel, () => {
      const bytes = statSync(abs).size;
      const buf = readFileSync(abs);
      return { bytes, text: decodeText(buf) };
    }, limits));
  }

  return { files, violations };
}

/** Decode as UTF-8, or return null when the buffer is not text. */
function decodeText(buf) {
  if (buf.includes(0)) return null;
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    return null;
  }
}
