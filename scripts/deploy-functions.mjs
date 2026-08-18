#!/usr/bin/env node
// Deploys every Edge Function in supabase/functions.
//
// The Supabase CLI deploys one function at a time, and `scan-alerts` needs
// `--no-verify-jwt` because it is called by a cron with a shared secret rather
// than a user token. Encoding that here keeps a deploy from silently locking the
// scheduler out.

import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const FUNCTIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'functions');

/** Functions invoked without a user JWT. */
const PUBLIC_FUNCTIONS = new Set(['scan-alerts']);

function discoverFunctions() {
  return readdirSync(FUNCTIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'))
    .map((entry) => entry.name)
    .sort();
}

function deploy(name) {
  const args = ['supabase', 'functions', 'deploy', name];
  if (PUBLIC_FUNCTIONS.has(name)) args.push('--no-verify-jwt');

  console.log(`\n> ${name}${PUBLIC_FUNCTIONS.has(name) ? ' (no JWT verification)' : ''}`);

  const result = spawnSync('npx', args, { stdio: 'inherit', shell: process.platform === 'win32' });
  return result.status === 0;
}

const functions = discoverFunctions();
if (functions.length === 0) {
  console.error('No functions found in supabase/functions.');
  process.exit(1);
}

const failed = functions.filter((name) => !deploy(name));

if (failed.length > 0) {
  console.error(`\nFailed to deploy: ${failed.join(', ')}`);
  process.exit(1);
}

console.log(`\nDeployed ${functions.length} function(s).`);
