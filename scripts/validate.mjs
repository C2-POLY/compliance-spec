#!/usr/bin/env node
// Validate YAML files against the v0.1 and v0.2 schemas.
// Usage: node scripts/validate.mjs [--schema <name>] <file>...
// Without --schema, the schema is picked from the file name (manifest.yaml, processing.yaml, actions.yaml, ...).
// The version is picked from the file's own spec_version: "0.2" uses schema/v0.2, anything else schema/v0.1.
import { readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { parse } from 'yaml';

export const SCHEMAS = ['manifest', 'processing', 'compliance', 'sync', 'anchors', 'actions'];
export const VERSIONS = ['0.1', '0.2'];
// The version a schema first exists in, when it is not the first version; it stays in every later one.
export const SINCE = { actions: '0.2' };
export const hasSchema = (version, schema) => VERSIONS.indexOf(version) >= VERSIONS.indexOf(SINCE[schema] ?? VERSIONS[0]);
const schemaRoot = join(dirname(fileURLToPath(import.meta.url)), '..', 'schema');

const ajv = new Ajv2020({ allErrors: true });
addFormats(ajv);
for (const version of VERSIONS) {
  for (const name of SCHEMAS.filter((s) => hasSchema(version, s))) {
    ajv.addSchema(JSON.parse(readFileSync(join(schemaRoot, `v${version}`, `${name}.schema.json`), 'utf8')), `${version}/${name}`);
  }
}

// File name convention: <schema>.yaml. Fixtures may also be named <anything>.yaml inside a folder named after the schema.
export function schemaFor(file) {
  const byName = basename(file).replace(/\.ya?ml$/, '');
  if (SCHEMAS.includes(byName)) return byName;
  return dirname(file).split(/[\\/]/).reverse().find((part) => SCHEMAS.includes(part));
}

// The schema version of a parsed file: its spec_version when it is a known version, else "0.1" (which then reports the bad spec_version).
export const versionOf = (doc) => (VERSIONS.includes(doc?.spec_version) ? doc.spec_version : '0.1');

// Rules JSON Schema cannot express: unique ids, and references between items of one manifest or of actions.yaml.
function crossChecks(schema, doc) {
  if (!['manifest', 'actions'].includes(schema) || typeof doc !== 'object' || doc === null) return [];
  const errors = [];
  const fail = (instancePath, message) => errors.push({ instancePath, keyword: 'ref', message });
  const duplicate = (instancePath, id) => errors.push({ instancePath, keyword: 'uniqueId', message: `duplicate id "${id}"` });
  if (schema === 'actions') {
    const contactIds = new Set();
    (doc.contacts ?? []).forEach((item, i) => {
      if (contactIds.has(item?.id)) duplicate(`/contacts/${i}/id`, item.id);
      contactIds.add(item?.id);
    });
    (doc.assignments ?? []).forEach((item, i) => {
      if (item?.contact !== undefined && !contactIds.has(item.contact)) fail(`/assignments/${i}/contact`, `no contact with id "${item.contact}"`);
    });
    return errors;
  }
  const dataIds = new Set((doc.personal_data ?? []).map((item) => item?.id));
  const componentIds = new Set((doc.service?.components ?? []).map((item) => item?.id));
  const processorIds = new Set((doc.processors ?? []).map((item) => item?.id));
  const seenComponents = new Set();
  (doc.service?.components ?? []).forEach((item, i) => {
    if (seenComponents.has(item?.id)) duplicate(`/service/components/${i}/id`, item.id);
    seenComponents.add(item?.id);
  });
  for (const list of ['personal_data', 'storage', 'processors', 'outbound_flows', 'automated_decisions', 'ai_features', 'notices']) {
    const seen = new Set();
    (doc[list] ?? []).forEach((item, i) => {
      if (seen.has(item?.id)) duplicate(`/${list}/${i}/id`, item.id);
      seen.add(item?.id);
      (item?.data ?? []).forEach((ref, j) => {
        if (!dataIds.has(ref)) fail(`/${list}/${i}/data/${j}`, `no personal_data with id "${ref}"`);
      });
      if (item?.component !== undefined && !componentIds.has(item.component)) {
        fail(`/${list}/${i}/component`, `no service component with id "${item.component}"`);
      }
      if (list === 'outbound_flows' && item?.processor !== undefined && !processorIds.has(item.processor)) {
        fail(`/${list}/${i}/processor`, `no processor with id "${item.processor}"`);
      }
      if (list === 'ai_features') {
        const obligations = new Set();
        (item?.obligations ?? []).forEach((o, j) => {
          if (obligations.has(o?.id)) duplicate(`/${list}/${i}/obligations/${j}/id`, o.id);
          obligations.add(o?.id);
        });
      }
    });
  }
  return errors;
}

// Returns a list of { instancePath, keyword, message }; empty means valid. The root path is "/".
export function validateFile(file, schema = schemaFor(file)) {
  if (!SCHEMAS.includes(schema)) throw new Error(`Unknown schema for ${file}. Use --schema (${SCHEMAS.join(', ')}).`);
  const doc = parse(readFileSync(file, 'utf8'));
  // A schema absent from the file's version is checked in the version it first exists in, which reports the spec_version.
  const version = hasSchema(versionOf(doc), schema) ? versionOf(doc) : SINCE[schema];
  const validate = ajv.getSchema(`${version}/${schema}`);
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
