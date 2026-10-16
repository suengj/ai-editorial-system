#!/usr/bin/env node
/**
 * export-web-catalog — public-safe, deterministic catalog for the Editorial Studio web app.
 *
 *   node scripts/export-web-catalog.mjs            write editorial/web-catalog/editorial-web-catalog.v1.json
 *   node scripts/export-web-catalog.mjs --check    exit 1 when the committed file is stale
 *
 * The catalog carries IDs, enums, value domains, schemas, visual recipes and rule REFERENCES
 * (path + sha256). It never carries rule prose, approved-example excerpts, private indexes,
 * Drive IDs or credentials. The AES git commit is NOT embedded (keeps output deterministic across
 * commits); the consumer pins the AES commit and the catalog sha256 itself.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RuleReader, loadManifest, resolveEditorial, stable, STATUS, REPO_ROOT } from './lib/resolve-core.mjs';
import { CAROUSEL_CONSTRAINTS, CAROUSEL_VERSION } from './lib/carousel-core.mjs';

export const CATALOG_VERSION = '1.0.0';
export const OUT_PATH = 'editorial/web-catalog/editorial-web-catalog.v1.json';
const VISUAL_RECIPES = 'editorial/visual-recipes.v1.json';
const SCHEMAS = {
  'art-direction-plan': 'schemas/art-direction-plan.schema.json',
  'editorial-intent': 'schemas/editorial-intent.schema.json',
  'visual-brief': 'schemas/visual-brief.schema.json',
  'render-spec': 'schemas/render-spec.schema.json',
  'feedback-record': 'schemas/feedback-record.schema.json',
  'native-card-review': 'schemas/native-card-review.schema.json',
  'video-plan': 'schemas/video-plan.schema.json',
  'video-plan-v2': 'schemas/video-plan-v2.schema.json',
  'video-profile': 'schemas/video-profile.schema.json',
  'video-qa': 'schemas/video-qa.schema.json',
  'narration-script': 'schemas/narration-script.schema.json',
  'narration-script-v2': 'schemas/narration-script-v2.schema.json',
  'tts-contract': 'schemas/tts-contract.schema.json',
  // Referenced by video-plan / narration-script ($ref schemas/...): included so the web can validate standalone.
  'audio-plan': 'schemas/audio-plan.schema.json',
  'audio-plan-v2': 'schemas/audio-plan-v2.schema.json',
  'bgm-catalog-v2': 'schemas/bgm-catalog-v2.schema.json',
  'editorial-package': 'schemas/editorial-package.schema.json',
};
// Only gates that govern unwanted copy. Ids/names/severity only: no patterns, no rationale prose.
const COPY_GATES = ['G-01', 'G-03', 'G-06'];
const sha = (buf) => createHash('sha256').update(buf).digest('hex');
const readJson = (rel) => JSON.parse(readFileSync(resolve(REPO_ROOT, rel), 'utf8'));
const readBytes = (rel) => readFileSync(resolve(REPO_ROOT, rel));

const stubIntent = (surface, artifacts) => ({
  intent_id: 'intent:web-catalog-export', request: { language: 'ko' },
  axes: {
    transformation: { value: 'synthesize' }, content_type: { value: 'research' }, audience: { value: 'domain-practitioner' },
    surface: { value: surface }, artifacts: artifacts.map((value) => ({ value })),
  },
});

function ruleRefs(receipt, label) {
  if (receipt.status !== STATUS.READY) throw new Error(`${label}: resolver status ${receipt.status}`);
  // Axis/language profile files depend on the request's axes (not the target): exposed as path templates instead.
  return receipt.loads.filter((l) => !l.path.startsWith('editorial/profiles/')).map((l) => {
    if (l.status !== 'read' || !l.sha256) throw new Error(`${label}: rule file ${l.path} is ${l.status}`);
    return { path: l.path, role: l.role, sha256: l.sha256.replace(/^sha256:/, '') };
  }).sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

export function buildCatalog() {
  const reader = new RuleReader({ revision: 'web-catalog-export' });
  const { manifest, sha256: manifestHash } = loadManifest(reader);
  const gatesDoc = readJson('editorial/quality-gates.json');

  const targets = Object.keys(manifest.sns_targets).sort().map((id) => {
    const t = manifest.sns_targets[id];
    const receipts = { text: resolveEditorial(stubIntent(t.surface, ['text/article']), { targetId: id, taskKind: 'text', reader }) };
    if (t.visual) receipts.visual = resolveEditorial(stubIntent(t.surface, t.visual.artifacts), { targetId: id, taskKind: 'visual', reader });
    return {
      id, label: t.account, channel: t.surface, voice_family: t.voice_family, status: t.status,
      task_kinds: Object.keys(receipts).sort(),
      visual_artifacts: t.visual?.artifacts ?? [],
      copy_defaults: t.copy_defaults ?? {}, visual_defaults: t.visual?.defaults ?? null,
      output_contract: t.output_contract ?? null,
      rule_refs: Object.fromEntries(Object.entries(receipts).map(([k, r]) => [k, ruleRefs(r, `${id}/${k}`)])),
    };
  });

  const flows = Object.keys(manifest.existing_flows).sort().map((id) => {
    const f = manifest.existing_flows[id];
    const receipts = { text: resolveEditorial(stubIntent(f.surface, f.artifacts), { flowId: id, taskKind: 'text', reader }) };
    if (f.artifacts.some((a) => a.startsWith('visual/'))) receipts.visual = resolveEditorial(stubIntent(f.surface, f.artifacts), { flowId: id, taskKind: 'visual', reader });
    return { id, label: id, channel: f.surface, status: f.status, artifacts: f.artifacts, voice_family: f.voice_family, task_kinds: Object.keys(receipts).sort(), rule_refs: Object.fromEntries(Object.entries(receipts).map(([k, r]) => [k, ruleRefs(r, `flow ${id}/${k}`)])) };
  });

  const schemas = Object.fromEntries(Object.entries(SCHEMAS).sort().map(([name, rel]) => {
    const body = readJson(rel);
    return [name, { id: body.$id, path: rel, sha256: sha(readBytes(rel)), schema: body }];
  }));

  const videoRoute = {
    task_kind: 'video',
    core: manifest.task_kinds.video.core.map((path) => ({ path, sha256: sha(readBytes(path)) })).sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0),
    profile_path_template: manifest.video_profile_paths,
    profiles: Object.fromEntries(Object.entries(manifest.video_profiles).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([id, pin]) => {
      const profileBytes = readBytes(pin.path);
      const profileSha = sha(profileBytes);
      if (profileSha !== pin.sha256) throw new Error(`video profile ${id} bytes do not match the manifest pin`);
      return [id, { path: pin.path, revision: pin.revision, sha256: pin.sha256, profile: JSON.parse(profileBytes.toString('utf8')) }];
    })),
  };

  // Any "schemas/..." $ref not shipped in the catalog is listed, never silently dropped.
  const shipped = new Set(Object.values(SCHEMAS));
  const missing_refs = [...new Set(JSON.stringify(Object.values(schemas).map((x) => x.schema)).match(/"\$ref":"(schemas\/[^"#]+)/g)?.map((m) => m.split('"').pop()) ?? [])].filter((r) => !shipped.has(r)).sort();
  const recipes = readJson(VISUAL_RECIPES);
  const gates = COPY_GATES.map((gid) => {
    const g = gatesDoc.gates.find((x) => x.id === gid);
    if (!g) throw new Error(`quality gate ${gid} missing`);
    return { id: g.id, title: g.name, severity: g.severity };
  });

  const body = {
    catalog_version: CATALOG_VERSION,
    generated_from: {
      manifest: { path: 'editorial/entry-manifest.json', manifest_version: manifest.manifest_version, sha256: manifestHash.replace(/^sha256:/, '') },
      rule_refs_scope: 'rule_refs are the target/flow-fixed subset only. Axis and language profile files are resolved per request via axis_profile_paths / language_packs. Approved-example excerpts are never included.',
      note: 'The AES git commit is deliberately not embedded. The consumer pins the AES commit and this file\'s sha256.',
      profile_version_semantics: '<manifest_version>+<aes_commit>; the consumer supplies aes_commit from its own pin',
    },
    axis_profile_paths: stable(manifest.axis_profile_paths),
    video_route: videoRoute,
    language_packs: stable(manifest.language_packs),
    carousel_series: { schema_version: CAROUSEL_VERSION, ...stable(CAROUSEL_CONSTRAINTS), signalytics_png: manifest.sns_targets['signalytics-news']?.output_contract?.png ?? null },
    flows,
    locked_fields: [...manifest.locked_fields].sort(),
    overridable_fields: stable(manifest.overridable_fields),
    field_domains: stable(Object.fromEntries(Object.entries(manifest.field_domains).filter(([k]) => k !== '_note'))),
    precedence: manifest.precedence,
    quality_gates: { copy_gates: gates, protected_spans: { id: gatesDoc.protectedSpans.id, severity: gatesDoc.protectedSpans.severity, classes: [...gatesDoc.protectedSpans.classes] } },
    schemas,
    schemas_missing_refs: missing_refs,
    targets,
    visual_recipes: { path: VISUAL_RECIPES, sha256: sha(readBytes(VISUAL_RECIPES)), recipes },
  };
  const digest = sha(JSON.stringify(stable(body)));
  return { content_digest: `sha256:${digest}`, ...body };
}

export const render = (catalog = buildCatalog()) => `${JSON.stringify(stable(catalog), null, 2)}\n`;

function main() {
  const out = process.env.WEB_CATALOG_OUT ? resolve(process.env.WEB_CATALOG_OUT) : resolve(REPO_ROOT, OUT_PATH);
  const next = render();
  if (process.argv.includes('--check')) {
    const cur = existsSync(out) ? readFileSync(out, 'utf8') : null;
    if (cur !== next) { console.error(`STALE: ${OUT_PATH} differs from the generated catalog. Run: node scripts/export-web-catalog.mjs`); process.exit(1); }
    console.log(`ok   ${OUT_PATH} is current`);
    return;
  }
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, next);
  console.log(`wrote ${OUT_PATH} (${Buffer.byteLength(next)} bytes)`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
