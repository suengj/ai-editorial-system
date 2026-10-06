#!/usr/bin/env node
/**
 * usage: node scripts/watermark.mjs --master <clean.png> [--render-spec <json>] [--brand <json>]
 *          [--config <json>] [--enable] [--out <derivative.png>]
 * Config layers (low to high): brand watermark_default, render-spec watermark, --config, --enable.
 * OFF (default): prints "off" and writes nothing; the master is the publication asset.
 * ON: writes a separate derivative + <out>.lineage.json. Never overwrites the master.
 */
import { readFileSync, writeFileSync, existsSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { applyWatermark, resolveWatermark, WatermarkError } from './lib/watermark-core.mjs';

const args = process.argv.slice(2); const get = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const j = (p) => JSON.parse(readFileSync(resolve(p), 'utf8'));
try {
  const master = get('--master'); if (!master) throw new WatermarkError('usage', 'missing --master');
  const layers = [get('--brand') && j(get('--brand')).watermark_default, get('--render-spec') && j(get('--render-spec')).watermark, get('--config') && j(get('--config')), args.includes('--enable') && { enabled: true }];
  const cfg = resolveWatermark(...layers);
  const bytes = readFileSync(resolve(master));
  const res = applyWatermark(bytes, cfg, { masterRef: master });
  if (!res.applied) { console.log('off: no derivative written; master bytes unchanged'); process.exit(0); }
  const out = get('--out'); if (!out) throw new WatermarkError('usage', '--out is required when the watermark is enabled');
  if (existsSync(out) && realpathSync(out) === realpathSync(master)) throw new WatermarkError('overwrite-master', 'refusing to overwrite the master');
  writeFileSync(out, res.bytes); writeFileSync(`${out}.lineage.json`, `${JSON.stringify(res.lineage, null, 2)}\n`);
  console.log(`marked: ${out} (${res.lineage.derivative_sha256}) from master ${res.lineage.master_sha256}`);
} catch (e) { console.error(`watermark: ${e.code ?? 'error'}: ${e.message}`); process.exit(1); }
