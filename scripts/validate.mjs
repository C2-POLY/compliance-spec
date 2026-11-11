#!/usr/bin/env node
// Validate YAML files against the v0.1 schemas.
// Usage: node scripts/validate.mjs [--schema <name>] <file>...
// Without --schema, the schema is picked from the file name (manifest.yaml, processing.yaml, ...).
import { readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { parse } from 'yaml';

export const SCHEMAS = ['manifest', 'processing', 'compliance', 'sync', 'anchors'];
const schemaDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'schema', 'v0.1');

const ajv = new Ajv2020({ allErrors: true });
addFormats(ajv);
for (const name of SCHEMAS) {
  ajv.addSchema(JSON.parse(readFileSync(join(schemaDir, `${name}.schema.json`), 'utf8')), name);
}

// File name convention: <schema>.yaml. Fixtures may also be named <anything>.yaml inside a folder named after the schema.
export function schemaFor(file) {
  const byName = basename(file).replace(/\.ya?ml$/, '');
  if (SCHEMAS.includes(byName)) return byName;
  return dirname(file).split(/[\\/]/).reverse().find((part) => SCHEMAS.includes(part));
}

// Rules JSON Schema cannot express: unique ids, and references between items of one manifest.
function crossChecks(schema, doc) {
  if (schema !== 'manifest' || typeof doc !== 'object' || doc === null) return [];
  const errors = [];
  const fail = (instancePath, message) => errors.push({ instancePath, keyword: 'ref', message });
  const dataIds = new Set((doc.personal_data ?? []).map((item) => item?.id));
  const componentIds = new Set((doc.service?.components ?? []).map((item) => item?.id));
  for (const list of ['personal_data', 'storage', 'processors', 'outbound_flows', 'automated_decisions', 'ai_features']) {
    const seen = new Set();
    (doc[list] ?? []).forEach((item, i) => {
      if (seen.has(item?.id)) errors.push({ instancePath: `/${list}/${i}/id`, keyword: 'uniqueId', message: `duplicate id "${item.id}"` });
      seen.add(item?.id);
      (item?.data ?? []).forEach((ref, j) => {
        if (!dataIds.has(ref)) fail(`/${list}/${i}/data/${j}`, `no personal_data with id "${ref}"`);
      });
      if (item?.component !== undefined && !componentIds.has(item.component)) {
        fail(`/${list}/${i}/component`, `no service component with id "${item.component}"`);
      }
    });
  }
  return errors;
}

// Returns a list of { instancePath, keyword, message }; empty means valid. The root path is "/".
export function validateFile(file, schema = schemaFor(file)) {
  if (!SCHEMAS.includes(schema)) throw new Error(`Unknown schema for ${file}. Use --schema (${SCHEMAS.join(', ')}).`);
  const doc = parse(readFileSync(file, 'utf8'));
  const validate = ajv.getSchema(schema);
  const errors = validate(doc) ? [] : validate.errors;
  return [...errors, ...crossChecks(schema, doc)].map(({ instancePath, keyword, message }) => ({
    instancePath: instancePath || '/',
    keyword,
    message,
  }));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  let schema;
  const flag = args.indexOf('--schema');
  if (flag !== -1) schema = args.splice(flag, 2)[1];
  if (args.length === 0) {
    console.error('Usage: node scripts/validate.mjs [--schema <name>] <file>...');
    process.exit(2);
  }
  let failed = false;
  for (const file of args) {
    try {
      const errors = validateFile(file, schema);
      if (errors.length === 0) console.log(`ok    ${file}`);
      else {
        failed = true;
        console.log(`FAIL  ${file}`);
        for (const e of errors) console.log(`  ${e.instancePath} [${e.keyword}] ${e.message}`);
      }
    } catch (err) {
      failed = true;
      console.log(`FAIL  ${file}\n  ${err.message}`);
    }
  }
  process.exit(failed ? 1 : 0);
}
