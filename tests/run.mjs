// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCHEMAS, schemaFor, validateFile } from '../scripts/validate.mjs';

const root = join(fileURLToPath(import.meta.url), '..', '..');
const fixtures = join(root, 'tests', 'fixtures');

const yamlFiles = (dir) =>
  existsSync(dir)
    ? readdirSync(dir, { recursive: true }).filter((f) => /\.ya?ml$/.test(f)).map((f) => join(dir, f)).sort()
    : [];
const rel = (file) => relative(root, file);

for (const schema of SCHEMAS) {
  for (const file of yamlFiles(join(fixtures, 'valid', schema))) {
    test(`valid ${rel(file)}`, () => {
      assert.deepEqual(validateFile(file, schema), []);
    });
  }

  for (const file of yamlFiles(join(fixtures, 'invalid', schema))) {
    test(`invalid ${rel(file)}`, () => {
      const match = readFileSync(file, 'utf8').match(/^# expect: (\S+) (\S+)\s*$/m);
      assert.ok(match, 'first line must be "# expect: <instancePath> <keyword>"');
      const [, instancePath, keyword] = match;
      const errors = validateFile(file, schema);
      assert.ok(
        errors.some((e) => e.instancePath === instancePath && e.keyword === keyword),
        `expected ${instancePath} ${keyword}, got: ${JSON.stringify(errors.map((e) => `${e.instancePath} ${e.keyword}`))}`,
      );
    });
  }
}

test('every schema has at least one valid and one invalid fixture', () => {
  for (const schema of SCHEMAS) {
    assert.ok(yamlFiles(join(fixtures, 'valid', schema)).length > 0, `no valid fixture for ${schema}`);
    assert.ok(yamlFiles(join(fixtures, 'invalid', schema)).length > 0, `no invalid fixture for ${schema}`);
  }
  assert.ok(yamlFiles(join(fixtures, 'invalid', 'manifest')).length >= 3);
});

for (const file of yamlFiles(join(root, 'examples'))) {
  test(`example ${rel(file)}`, () => {
    assert.ok(schemaFor(rel(file)), 'file name must match a schema (manifest.yaml, sync.yaml, ...)');
    assert.deepEqual(validateFile(file), []);
  });
}

test('schema $id matches the published URL', () => {
  for (const name of SCHEMAS) {
    const schema = JSON.parse(readFileSync(join(root, 'schema', 'v0.1', `${name}.schema.json`), 'utf8'));
    assert.equal(schema.$id, `https://raw.githubusercontent.com/C2-POLY/compliance-spec/v0.1.0/schema/v0.1/${name}.schema.json`);
    assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
  }
});

test('the manifest spec example is the bistro-api fixture and the bistro-api example', () => {
  const fixture = readFileSync(join(fixtures, 'valid', 'manifest', 'bistro-api.yaml'), 'utf8');
  const example = readFileSync(join(root, 'examples', 'bistro-booking', 'services', 'bistro-api', 'manifest.yaml'), 'utf8');
  assert.equal(example, fixture);
  const spec = readFileSync(join(root, 'spec', 'manifest.md'), 'utf8');
  const block = spec.split('## Worked example')[1]?.match(/```yaml\n([\s\S]*?)```/)?.[1];
  assert.equal(block, fixture);
});

const missingServices = (dir) =>
  spawnSync(process.execPath, [join(root, 'scripts', 'missing-services.mjs'), dir], { encoding: 'utf8' });

test('missing-services reports the repo without a services folder and exits 1', () => {
  const result = missingServices(join(fixtures, 'repos', 'missing'));
  assert.equal(result.status, 1);
  assert.match(result.stdout, /^missing: bistro-web /m);
  assert.doesNotMatch(result.stdout, /bistro-api|bistro-analytics/);
});

test('missing-services exits 0 on the Bistro Booking example', () => {
  const result = missingServices(join(root, 'examples', 'bistro-booking'));
  assert.equal(result.status, 0);
  assert.equal(result.stdout, '');
});
