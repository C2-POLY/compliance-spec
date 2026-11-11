#!/usr/bin/env node
// Check that every manifest field path named in skills/compliance-step/triggers.yaml exists in the manifest schema.
// Usage: node scripts/check-triggers.mjs [triggers.yaml]
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const schemaFile = join(root, 'schema', 'v0.1', 'manifest.schema.json');
const defaultTriggers = join(root, 'skills', 'compliance-step', 'triggers.yaml');

const deref = (schema, node) => {
  while (node?.$ref) node = node.$ref.replace(/^#\//, '').split('/').reduce((n, key) => n?.[key], schema);
  return node;
};

// A path looks like `processors[].retention.duration`: `.` goes into properties, `[]` into items.
export function pathExists(schema, path) {
  let node = deref(schema, schema);
  for (const part of path.split('.')) {
    const match = part.match(/^([A-Za-z_][\w-]*)(\[\])?$/);
    if (!match) return false;
    node = deref(schema, node?.properties?.[match[1]]);
    if (match[2]) node = deref(schema, node?.items);
    if (!node) return false;
  }
  return true;
}

// Returns the list of "<question id>: <path>" for every path that is not in the schema.
export function orphans(mapping, schema) {
  const found = [];
  for (const trigger of mapping?.triggers ?? []) {
    for (const q of trigger.questions ?? []) {
      for (const path of [q.field, ...(q.also ?? [])]) {
        if (typeof path !== 'string' || !pathExists(schema, path)) found.push(`${q.id}: ${path}`);
      }
    }
  }
  return found;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const file = process.argv[2] ?? defaultTriggers;
  const missing = orphans(parse(readFileSync(file, 'utf8')), JSON.parse(readFileSync(schemaFile, 'utf8')));
  if (missing.length === 0) console.log(`ok    ${file}`);
  else {
    console.log(`FAIL  ${file}`);
    for (const m of missing) console.log(`  not in the manifest schema: ${m}`);
  }
  process.exit(missing.length === 0 ? 0 : 1);
}
