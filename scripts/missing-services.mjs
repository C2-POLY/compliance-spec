#!/usr/bin/env node
// List the repos of compliance.yaml that must send a manifest (expected_to_send: true)
// but have no services/<name>/ folder. Exit 1 if any is missing.
// Usage: node scripts/missing-services.mjs <compliance-repo-dir>
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

const dir = process.argv[2];
if (!dir) {
  console.error('Usage: node scripts/missing-services.mjs <compliance-repo-dir>');
  process.exit(2);
}

const isDir = (path) => {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
};

let compliance;
try {
  compliance = parse(readFileSync(join(dir, 'compliance.yaml'), 'utf8'));
} catch (err) {
  console.error(`Cannot read compliance.yaml in ${dir}: ${err.message}`);
  process.exit(2);
}

const missing = (compliance.repos ?? []).filter((repo) => repo.expected_to_send && !isDir(join(dir, 'services', repo.name)));
for (const repo of missing) console.log(`missing: ${repo.name} (owner: ${repo.owner})`);
process.exit(missing.length > 0 ? 1 : 0);
