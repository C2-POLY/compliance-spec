// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { SCHEMAS, schemaFor, validateFile } from '../scripts/validate.mjs';
import { orphans } from '../scripts/check-triggers.mjs';

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

// Compliance step (skills/compliance-step)
const stepDir = join(root, 'skills', 'compliance-step');
const manifestSchema = JSON.parse(readFileSync(join(root, 'schema', 'v0.1', 'manifest.schema.json'), 'utf8'));
const triggersMapping = parse(readFileSync(join(stepDir, 'triggers.yaml'), 'utf8'));
const triggerQuestions = new Map(triggersMapping.triggers.flatMap((t) => t.questions.map((q) => [q.id, { ...q, trigger: t.id }])));
const baseManifestFile = join(root, 'examples', 'bistro-booking', 'services', 'bistro-api', 'manifest.yaml');
const baseManifest = parse(readFileSync(baseManifestFile, 'utf8'));
const frontMatter = (file) => parse(readFileSync(file, 'utf8').match(/^---\n([\s\S]*?)\n---/)[1]);
const scenarios = readdirSync(join(stepDir, 'scenarios')).sort();

test('every manifest field path in triggers.yaml exists in the manifest schema', () => {
  assert.deepEqual(orphans(triggersMapping, manifestSchema), []);
});

test('check-triggers reports a bogus field path', () => {
  const mapping = {
    triggers: [{ id: 'z', questions: [
      { id: 'z1', field: 'processors[].name' },
      { id: 'z2', field: 'processors[].colour' },
      { id: 'z3', field: 'personal_data[].fields[].category', also: ['storage[].retention.nope'] },
    ] }],
  };
  assert.deepEqual(orphans(mapping, manifestSchema), ['z2: processors[].colour', 'z3: storage[].retention.nope']);
});

test('triggers.yaml has four triggers with 2 to 4 questions each, unique ids', () => {
  assert.deepEqual(triggersMapping.triggers.map((t) => t.id), ['a', 'b', 'c', 'd']);
  for (const t of triggersMapping.triggers) assert.ok(t.questions.length >= 2 && t.questions.length <= 4, t.id);
  assert.equal(triggerQuestions.size, triggersMapping.triggers.reduce((n, t) => n + t.questions.length, 0));
});

test('there are three scenarios', () => {
  assert.deepEqual(scenarios, ['01-guest-phone', '02-sms-provider', '03-button-colour']);
});

for (const name of scenarios) {
  const dir = join(stepDir, 'scenarios', name);

  test(`scenario ${name}: expected manifest is valid`, () => {
    assert.deepEqual(validateFile(join(dir, 'expected-manifest.yaml'), 'manifest'), []);
  });

  test(`scenario ${name}: questions come from triggers.yaml and match the fired triggers`, () => {
    const file = join(dir, 'expected-questions.md');
    const { triggers } = frontMatter(file);
    const asked = [...readFileSync(file, 'utf8').matchAll(/^\d+\. (\w+): (.+)$/gm)];
    for (const [, id, text] of asked) {
      assert.equal(triggerQuestions.get(id)?.text, text, `question ${id} must match triggers.yaml`);
    }
    assert.deepEqual([...new Set(asked.map(([, id]) => triggerQuestions.get(id).trigger))], triggers);
  });

  test(`scenario ${name}: section matches the fired triggers`, () => {
    const section = readFileSync(join(dir, 'expected-section.md'), 'utf8');
    const { triggers } = frontMatter(join(dir, 'expected-questions.md'));
    if (triggers.length === 0) {
      assert.match(section, /^GDPR impact: none\n[^\n]+\n$/);
    } else {
      assert.match(section, /^\*\*Compliance\*\*\n\n(- [^\n]+\n)+\nManifest: updated in this branch\n$/);
      assert.equal(section.split('\n- ').length - 1, triggers.length);
    }
  });
}

test('scenario 03: the expected manifest is the starting manifest, byte for byte', () => {
  const expected = readFileSync(join(stepDir, 'scenarios', '03-button-colour', 'expected-manifest.yaml'), 'utf8');
  assert.equal(expected, readFileSync(baseManifestFile, 'utf8'));
});

for (const name of ['01-guest-phone', '02-sms-provider']) {
  test(`scenario ${name}: every changed or added item has source spec and the issue url`, () => {
    const dir = join(stepDir, 'scenarios', name);
    const { url } = frontMatter(join(dir, 'issue.md'));
    const expected = parse(readFileSync(join(dir, 'expected-manifest.yaml'), 'utf8'));
    let changed = 0;
    for (const list of ['personal_data', 'storage', 'processors', 'outbound_flows', 'automated_decisions', 'ai_features']) {
      const before = new Map(baseManifest[list].map((item) => [item.id, item]));
      const after = new Set(expected[list].map((item) => item.id));
      for (const id of before.keys()) assert.ok(after.has(id), `${list}/${id} must not be removed`);
      for (const item of expected[list]) {
        if (JSON.stringify(before.get(item.id)) === JSON.stringify(item)) continue;
        changed += 1;
        assert.deepEqual(item.source, { kind: 'spec', ref: url }, `${list}/${item.id}`);
      }
    }
    assert.ok(changed > 0, 'the scenario must change the manifest');
    assert.deepEqual(expected.service, baseManifest.service);
  });
}
