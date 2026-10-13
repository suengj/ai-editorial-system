#!/usr/bin/env node
/**
 * SUE-1426 second fix round (review 2). Items are numbered as in the review: 1 legacy report-deck render,
 * 2 packet "ok" wrapper, 3 explicit preference checks, 4 single active version, 5-15 should-fix.
 * CLIs are driven as documented; no network, no publishing.
 */
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, cpSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { loadManifest, RuleReader, gateRender } from './lib/resolve-core.mjs';
import { loadAxisProfiles } from './lib/profile-core.mjs';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, '..');
let pass = 0, failed = 0;
const test = (name, fn) => { try { fn(); pass++; console.log(`  ok   ${name}`); } catch (e) { failed++; console.log(`  FAIL ${name}\n       ${e.message}`); } };
const eq = (a, b, m = '') => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m} expected ${JSON.stringify(b)} got ${JSON.stringify(a)}`); };
const yes = (c, m) => { if (!c) throw new Error(m); };
const tmp = () => mkdtempSync(resolve(tmpdir(), 'aes-r2-'));
const node = (args, opts = {}) => spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8', ...opts });
const hasRasterizer = spawnSync('which', ['rsvg-convert'], { encoding: 'utf8' }).status === 0;
const manifest = loadManifest(new RuleReader()).manifest;

console.log('1: legacy report-deck slide images stay renderable');
{
  const cardPlan = (surface, artifact) => { const p = JSON.parse(readFileSync(resolve(ROOT, 'scripts/fixtures/visual-execution/card.json'), 'utf8')); p.profiles = { surface, artifact }; return p; };
  test('sweep: every non-SNS surface x artifact_fit is ungated (as on main)', () => {
    const surfaces = loadAxisProfiles('surface');
    for (const [id, prof] of Object.entries(surfaces)) {
      if (['instagram', 'linkedin'].includes(id)) continue;
      for (const artifact of prof.artifact_fit ?? []) {
        const g = gateRender(cardPlan(id, artifact), null, manifest);
        yes(g.ok && g.applies === false, `${id} x ${artifact}: ${JSON.stringify(g)}`);
      }
    }
  });
  test('an artifact only SNS targets map still needs a receipt on a surface that does not declare it', () => {
    const g = gateRender(cardPlan('newsletter', 'visual/social-card'), null, manifest);
    yes(!g.ok && g.code === 'PROFILE_RECEIPT_REQUIRED', JSON.stringify(g));
  });
  test('manifest: report flow maps visual/slide-image so a flow receipt also works', () => yes(manifest.existing_flows.report.artifacts.includes('visual/slide-image'), 'unmapped'));
  if (hasRasterizer) {
    test('render-visual CLI: report-deck + slide-image renders without a receipt (exit 0) and with a --flow report receipt', () => {
      const d = tmp(); writeFileSync(resolve(d, 'plan.json'), JSON.stringify(cardPlan('report-deck', 'visual/slide-image'))); cpSync(resolve(ROOT, 'scripts/fixtures/visual-execution/source.md'), resolve(d, 'source.md'));
      const r = node(['scripts/render-visual.mjs', '--plan', resolve(d, 'plan.json'), '--out', resolve(d, 'o')]);
      eq(r.status, 0, r.stderr); yes(/RENDERED_NEEDS_REVIEW/.test(r.stdout), r.stdout);
      const rc = node(['scripts/resolve-editorial.mjs', '--plan', resolve(d, 'plan.json'), '--flow', 'report', '--out', resolve(d, 'r.json')]); eq(rc.status, 0, rc.stderr + rc.stdout);
      const r2 = node(['scripts/render-visual.mjs', '--plan', resolve(d, 'plan.json'), '--out', resolve(d, 'o2'), '--profile-receipt', resolve(d, 'r.json')]); eq(r2.status, 0, r2.stderr);
    });
    test('render-carousel CLI: a report-deck series renders without a receipt (exit 0)', () => {
      const d = tmp(), s = JSON.parse(readFileSync(resolve(ROOT, 'scripts/fixtures/carousel/series.json'), 'utf8')); s.profiles = { surface: 'report-deck', artifact: 'visual/slide-image' };
      for (const f of ['source.md', 'counts.json']) cpSync(resolve(ROOT, 'scripts/fixtures/carousel', f), resolve(d, f));
      writeFileSync(resolve(d, 'series.json'), JSON.stringify(s));
      const r = node(['scripts/render-carousel.mjs', '--plan', resolve(d, 'series.json'), '--out', resolve(d, 'o')]);
      eq(r.status, 0, r.stderr + r.stdout);
    });
  } else console.log('  skip render CLI tests (no rasterizer)');
}

// <<SECTIONS>>

console.log(`\nentry-review2: ${pass} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
