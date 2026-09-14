import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const functionsRoot = join(dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'functions');
const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', '.tmp');
mkdirSync(outDir, { recursive: true });

const IMPORT_RE = /from ['"](\.\.?\/[^'"]+)['"]/g;

function resolveImport(fromFile, spec) {
  const abs = join(dirname(fromFile), spec);
  return abs.endsWith('.ts') ? abs : `${abs}.ts`;
}

function collect(entrypoint) {
  const pending = [join(functionsRoot, entrypoint)];
  const seen = new Set();
  const files = [];

  while (pending.length > 0) {
    const full = pending.pop();
    if (seen.has(full)) continue;
    seen.add(full);
    const content = readFileSync(full, 'utf8');
    const name = relative(functionsRoot, full).replaceAll('\\', '/');
    files.push({ name, content });
    for (const match of content.matchAll(IMPORT_RE)) {
      pending.push(resolveImport(full, match[1]));
    }
  }

  files.push({
    name: 'deno.json',
    content: readFileSync(join(functionsRoot, 'deno.json'), 'utf8'),
  });
  return files;
}

const functions = [
  'market-data',
  'summarize-news',
  'ai-chat',
  'recommend',
  'register-push-token',
  'scan-alerts',
  'paper-trade',
];

for (const name of functions) {
  const files = collect(`${name}/index.ts`);
  const chars = files.reduce((sum, file) => sum + file.content.length, 0);
  writeFileSync(join(outDir, `${name}.json`), JSON.stringify({ name, files }));
  console.log(`${name}\t${files.length} files\t${chars} chars`);
}
