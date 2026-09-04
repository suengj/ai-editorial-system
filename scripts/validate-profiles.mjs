#!/usr/bin/env node
/**
 * validate-profiles — AES-V2.2 (SUE-560)
 *
 * Validates the profile axis registry: editorial/profiles/axes.json plus
 * every profile file it points at. Dependency-free, driven entirely by
 * axes.json — no axis id is hardcoded here beyond the small set of
 * cross-axis reference field names every axis is free to use advisorially.
 *
 * Checks:
 *   (a) every axis declared populated:true has a non-empty directory
 *   (b) every profile file's id matches its filename and the axis id_pattern
 *   (c) every profile carries schema_version
 *   (d) the required-key shape is uniform within each axis (the keys common
 *       to every profile file in that axis cover at least schema_version and
 *       the axis's own id field — content-type-specific extensions such as
 *       `freshness` or `limits` are allowed on top of that shared core)
 *   (e) cross-axis references (typical_content_types, typical_surfaces,
 *       artifact_fit) name ids that exist, or belong to an axis that is
 *       declared unpopulated (advisory ids for a package that has not
 *       landed yet are not a defect)
 *
 * Usage: node scripts/validate-profiles.mjs
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadAxes, PROFILES_ROOT } from './lib/profile-core.mjs';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const rel = (p) => relative(REPO_ROOT, p);

// Fields any profile may use to point at ids in another axis. Advisory only
// (see docs/architecture/V2-EDITORIAL-LEARNING-CORE.md §3, "Plus task-specific
// overrides" is a separate mechanism) — enforcement lives in the schema/router
// once that axis is populated, not here.
const CROSS_REF_FIELDS = {
  typical_content_types: 'content',
  typical_surfaces: 'surface',
  artifact_fit: 'artifact',
};

const issues = [];
const fail = (where, message) => issues.push({ where, message });

// Notes are reported but do not fail the run. They exist so a known,
// deliberately-unbuilt gap stays visible instead of being silently tolerated
// or misreported as an error.
const notes = [];
const note = (where, message) => notes.push({ where, message });

const axes = loadAxes();
if (!Array.isArray(axes) || axes.length === 0) {
  console.error('profiles: FAIL — editorial/profiles/axes.json declares no axes');
  process.exit(1);
}

/** axis id -> { axis, ids: Set<string> } loaded from disk, for cross-ref checks. */
const loaded = new Map();

for (const axis of axes) {
  const dir = resolve(PROFILES_ROOT, axis.dir);
  const label = `axis:${axis.axis}`;

  if (!axis.populated) {
    if (existsSync(dir)) {
      const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
      if (files.length > 0) {
        fail(label, `declared populated:false but ${rel(dir)} already has ${files.length} profile(s) — flip populated to true`);
      }
    }
    continue;
  }

  // --- (a) directory exists and is non-empty --------------------------------
  if (!existsSync(dir)) {
    fail(label, `declared populated:true but ${rel(dir)} does not exist`);
    continue;
  }
  const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
  if (files.length === 0) {
    fail(label, `declared populated:true but ${rel(dir)} has no profile files`);
    continue;
  }

  const idPattern = new RegExp(axis.id_pattern);
  const ids = new Set();
  const keySets = [];

  for (const file of files) {
    const path = resolve(dir, file);
    const stem = file.replace(/\.json$/, '');
    let profile;
    try {
      profile = JSON.parse(readFileSync(path, 'utf8'));
    } catch (e) {
      fail(rel(path), `invalid JSON — ${e.message}`);
      continue;
    }

    const id = profile[axis.id_field] ?? stem;

    // --- (b) id matches filename and the axis id_pattern --------------------
    // Namespaced axes write "/" as "-" in the filename: visual/thumbnail lives
    // in visual-thumbnail.json. The id stays namespaced so a modality prefix
    // cannot be lost, which is what keeps text/visual/audio contracts separate.
    // A versioned axis carries its version in the filename (suengj-com.v1.json)
    // so an older profile is never overwritten in place; the id itself stays
    // unversioned, and profile_version inside the file is the authority.
    const bareStem = axis.filename_rule?.startsWith('versioned')
      ? stem.replace(/\.v\d+$/, '')
      : stem;
    if (id.replace(/\//g, '-') !== bareStem) {
      fail(rel(path), `profile id "${id}" does not match filename "${stem}.json"`);
    }
    if (!idPattern.test(id)) {
      fail(rel(path), `id "${id}" does not match axis id_pattern ${axis.id_pattern}`);
    }
    ids.add(id);

    // --- (c) schema_version present ------------------------------------------
    if (typeof profile.schema_version !== 'string' || profile.schema_version.length === 0) {
      fail(rel(path), 'missing schema_version');
    }

    keySets.push({ file: rel(path), keys: new Set(Object.keys(profile)), modality: profile.modality });
  }

  // --- (d) uniform required-key shape within the axis -------------------------
  if (keySets.length > 0) {
    const [first, ...rest] = keySets;
    let common = new Set(first.keys);
    for (const { keys } of rest) {
      common = new Set([...common].filter((k) => keys.has(k)));
    }
    const mustCover = new Set(['schema_version', axis.id_field]);
    for (const required of mustCover) {
      if (!common.has(required) && keySets.every(({ keys }) => keys.has(required))) {
        // present everywhere but computed intersection missed it — defensive,
        // should not happen given how `common` is built.
        common.add(required);
      }
    }
    for (const required of mustCover) {
      if (!common.has(required)) {
        fail(label, `profiles do not share a uniform "${required}" field — not every file in ${rel(dir)} carries one`);
      }
    }
  }

  // --- (d2) uniform required-key shape within each modality sub-group --------
  // The axis-wide check above (d) only guarantees uniformity across every
  // file in the directory, which for the `artifact` axis mixes visual, audio,
  // (planned) text, and (deferred) video profiles — their intersection is
  // tiny (schema_version, artifact, modality, family, primary_job,
  // renderer_preference, audience_adaptation, acceptance, reject,
  // source_authority) and does not cover modality-specific load-bearing keys
  // like a visual profile's `semantic_density`/`visual_density`/`text_policy`
  // or an audio profile's `thought_unit`/`rhythm`/`pronunciation_policy`. A
  // profile that dropped one of those previously passed this validator and
  // crashed a consuming engine instead (e.g. visual-job-core.mjs reading
  // `profile.semantic_density.level`) — see I9 in the V2 tuning review.
  //
  // This check is data-driven, not a hardcoded per-modality field list: for
  // any axis whose profiles declare a `modality`, group by that value, and
  // for each file, require it to carry every key its OTHER same-modality
  // siblings all share. A field only one modality's profiles use (e.g.
  // audio's `speaker_roles`, present only on dialogue profiles) never
  // becomes "required" by this check, because it is not common to every
  // sibling to begin with — only fields universal within a modality group
  // are enforced, and which fields those are is discovered from the files
  // themselves, not written into this function.
  const modalityGroups = new Map();
  for (const ks of keySets) {
    if (!ks.modality) continue;
    if (!modalityGroups.has(ks.modality)) modalityGroups.set(ks.modality, []);
    modalityGroups.get(ks.modality).push(ks);
  }
  for (const [modality, group] of modalityGroups) {
    if (group.length < 2) continue; // nothing to compare a lone profile against
    for (const target of group) {
      const siblings = group.filter((g) => g !== target);
      let sharedBySiblings = new Set(siblings[0].keys);
      for (const s of siblings.slice(1)) {
        sharedBySiblings = new Set([...sharedBySiblings].filter((k) => s.keys.has(k)));
      }
      const missing = [...sharedBySiblings].filter((k) => !target.keys.has(k));
      if (missing.length > 0) {
        fail(target.file,
          `missing ${missing.map((k) => `"${k}"`).join(', ')} — every other ${axis.axis}/${modality} profile carries ${missing.length === 1 ? 'it' : 'them'}`);
      }
    }
  }

  loaded.set(axis.axis, ids);
}

// --- (e) cross-axis references ----------------------------------------------
for (const axis of axes) {
  if (!axis.populated) continue;
  const dir = resolve(PROFILES_ROOT, axis.dir);
  if (!existsSync(dir)) continue;
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    const path = resolve(dir, file);
    let profile;
    try {
      profile = JSON.parse(readFileSync(path, 'utf8'));
    } catch {
      continue; // already reported above
    }
    for (const [field, targetAxisId] of Object.entries(CROSS_REF_FIELDS)) {
      const values = profile[field];
      if (!Array.isArray(values)) continue;
      const targetAxis = axes.find((a) => a.axis === targetAxisId);
      if (!targetAxis) {
        fail(rel(path), `${field} references unknown axis "${targetAxisId}"`);
        continue;
      }
      if (!targetAxis.populated) continue; // advisory id for a package not yet landed
      const known = loaded.get(targetAxisId) ?? new Set();
      const planned = new Set(targetAxis.planned ?? []);
      const deferred = new Set(targetAxis.deferred ?? []);
      for (const value of values) {
        if (known.has(value)) continue;
        // A reference to a declared-but-unbuilt id is a visible gap, not a
        // typo. It is reported so it cannot be forgotten, and does not fail —
        // otherwise a surface profile could not honestly describe a
        // destination whose artifact profile lands in a later package.
        if (planned.has(value)) {
          note(rel(path), `${field} references "${value}" — declared planned in the ${targetAxisId} axis, not yet built`);
        } else if (deferred.has(value)) {
          note(rel(path), `${field} references "${value}" — explicitly deferred in the ${targetAxisId} axis`);
        } else {
          fail(rel(path), `${field} references "${value}", which is not a known ${targetAxisId} id`);
        }
      }
    }
  }
}

for (const n of notes) console.log(`profiles: NOTE — [${n.where}] ${n.message}`);

if (issues.length === 0) {
  const populated = axes.filter((a) => a.populated).map((a) => a.axis);
  console.log(`profiles: PASS — ${axes.length} axes declared, ${populated.length} populated (${populated.join(', ')})${notes.length ? `, ${notes.length} note(s)` : ''}`);
  process.exit(0);
}

console.error(`profiles: FAIL — ${issues.length} issue(s)`);
for (const i of issues) console.error(`  [${i.where}] ${i.message}`);
console.error('\nSee editorial/profiles/README.md and editorial/profiles/axes.json.');
process.exit(1);
