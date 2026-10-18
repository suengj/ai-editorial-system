#!/usr/bin/env node
/**
 * Journey envelope writer CLI — SUE-1659.
 *
 *   init        create an envelope at RECEIVED
 *   transition  record evidence refs and advance (or resume) to a progress state
 *   interrupt   record a typed pause
 *   show        print the recovered state (fails closed on a bad file)
 *
 * Every write goes through the core validator and an atomic temp+rename.
 * External record refs need a resolver: --records <bundle.json> and/or
 * --repo <owner/name>=<local clone dir> (repeatable, read via `git show`).
 * Without one, external refs fail closed with BLOCKED_TRANSPORT.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  CODES,
  createRecordBundleResolver,
  parseJourneyJson,
  recoverJourneyState,
} from './lib/journey-envelope-core.mjs';
import {
  initJourneyFile,
  readJourneyFile,
  updateJourneyFile,
  applyInterrupt,
  applyTransition,
} from './lib/journey-envelope-writer.mjs';

const USAGE = `usage:
  journey-envelope.mjs init --file F --slug S --ledger-ref ref.json [--at ISO] [resolver]
  journey-envelope.mjs transition --file F --to STATE [--evidence evidence.json] [--at ISO] [resolver]
  journey-envelope.mjs interrupt --file F --code CODE [--reason-ref ref.json] [--at ISO] [resolver]
  journey-envelope.mjs show --file F [--json] [resolver]
resolver: --records bundle.json  and/or  --repo owner/name=dir (repeatable)
          --local-root dir (clone used for suengj/ai-editorial-system refs; default: this repo)`;

const VALUE_FLAGS = new Set([
  '--file', '--slug', '--ledger-ref', '--to', '--evidence', '--code', '--reason-ref',
  '--at', '--records', '--repo', '--local-root',
]);
const BOOLEAN_FLAGS = new Set(['--json']);

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = { repos: [] };
  for (let index = 0; index < rest.length; index += 1) {
    const flag = rest[index];
    if (BOOLEAN_FLAGS.has(flag)) {
      options[flag.slice(2)] = true;
    } else if (VALUE_FLAGS.has(flag)) {
      const value = rest[index + 1];
      if (value === undefined || value.startsWith('--')) throw new Error(`${flag} requires a value`);
      index += 1;
      if (flag === '--repo') options.repos.push(value);
      else options[flag.slice(2)] = value;
    } else {
      throw new Error(`unknown argument ${flag}`);
    }
  }
  return { command, options };
}

const need = (options, name) => {
  if (!options[name]) throw new Error(`--${name} is required`);
  return options[name];
};
const readJson = (path) => parseJourneyJson(readFileSync(resolve(path)), path);

function referenceOptionsFrom(options) {
  const resolvers = [];
  if (options.records) {
    resolvers.push(createRecordBundleResolver(readJson(options.records)));
  }
  if (options.repos.length > 0) {
    const dirs = new Map(options.repos.map((entry) => {
      const split = entry.indexOf('=');
      if (split < 1) throw new Error(`--repo expects owner/name=dir, got ${entry}`);
      return [entry.slice(0, split), resolve(entry.slice(split + 1))];
    }));
    resolvers.push((ref) => {
      const dir = dirs.get(ref.repository);
      if (!dir) return undefined;
      return execFileSync('git', ['show', `${ref.commit}:${ref.path}`], {
        cwd: dir, encoding: null, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024,
      });
    });
  }
  const referenceOptions = {};
  if (options['local-root']) referenceOptions.localRoot = resolve(options['local-root']);
  if (resolvers.length > 0) {
    referenceOptions.resolveExternalRecord = (ref) => {
      for (const resolveRecord of resolvers) {
        const raw = resolveRecord(ref);
        if (raw !== undefined && raw !== null) return raw;
      }
      return undefined;
    };
  }
  return referenceOptions;
}

function report(outcome, file) {
  if (outcome.ok) {
    const envelope = outcome.envelope;
    console.log(JSON.stringify({
      ok: true,
      result: outcome.result,
      file,
      journey_id: envelope.journey_id,
      state: envelope.state,
      last_good_state: envelope.last_good_state,
    }));
    return 0;
  }
  for (const entry of outcome.issues) {
    console.error(`journey-envelope: FAIL [${entry.code}] ${entry.where} — ${entry.message}`);
  }
  return 1;
}

function run(argv) {
  const { command, options } = parseArgs(argv);
  const referenceOptions = referenceOptionsFrom(options);
  const file = resolve(need(options, 'file'));
  const observedAt = options.at;

  switch (command) {
    case 'init':
      return report(initJourneyFile(file, {
        slug: need(options, 'slug'),
        ledgerRef: readJson(need(options, 'ledger-ref')),
        observedAt,
      }, referenceOptions), file);
    case 'transition': {
      const to = need(options, 'to');
      const evidence = options.evidence ? readJson(options.evidence) : {};
      return report(updateJourneyFile(file,
        (envelope) => applyTransition(envelope, { to, evidence, observedAt }, referenceOptions),
        referenceOptions), file);
    }
    case 'interrupt': {
      const code = need(options, 'code');
      const reasonRef = options['reason-ref'] ? readJson(options['reason-ref']) : undefined;
      return report(updateJourneyFile(file,
        (envelope) => applyInterrupt(envelope, code, { reasonRef, observedAt }, referenceOptions),
        referenceOptions), file);
    }
    case 'show': {
      const read = readJourneyFile(file, referenceOptions);
      if (!read.ok) return report(read, file);
      const recovered = recoverJourneyState(read.raw, referenceOptions);
      if (!recovered.ok) return report({ ok: false, issues: recovered.issues }, file);
      if (options.json) {
        console.log(JSON.stringify({ ...recovered, envelope: read.envelope }, null, 2));
      } else {
        console.log(`journey ${read.envelope.journey_id}: ${recovered.state}` +
          ` (last good ${recovered.last_good_state}, resume from ${recovered.resume_from ?? 'n/a — terminal'})`);
      }
      return 0;
    }
    default:
      throw new Error(`unknown command ${command ?? '<none>'}`);
  }
}

try {
  process.exit(run(process.argv.slice(2)));
} catch (error) {
  if (error.code === CODES.HANDOFF_INVALID) {
    console.error(`journey-envelope: FAIL [${CODES.HANDOFF_INVALID}] ${error.message}`);
    process.exit(1);
  }
  console.error(`journey-envelope: ${error.message}\n${USAGE}`);
  process.exit(2);
}
