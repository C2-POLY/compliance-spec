// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, stringify } from 'yaml';
import { SCHEMAS, VERSIONS, hasSchema, schemaFor, validateFile, versionOf } from '../scripts/validate.mjs';
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

const versionOfFile = (file) => versionOf(parse(readFileSync(file, 'utf8')));

test('every schema has at least one valid and one invalid fixture in each version that has it', () => {
  for (const schema of SCHEMAS) {
    for (const version of VERSIONS.filter((v) => hasSchema(v, schema))) {
      assert.ok(yamlFiles(join(fixtures, 'valid', schema)).some((f) => versionOfFile(f) === version), `no valid ${version} fixture for ${schema}`);
      assert.ok(yamlFiles(join(fixtures, 'invalid', schema)).some((f) => versionOfFile(f) === version), `no invalid ${version} fixture for ${schema}`);
    }
  }
  assert.ok(yamlFiles(join(fixtures, 'invalid', 'manifest')).length >= 3);
});

for (const file of yamlFiles(join(root, 'examples'))) {
  test(`example ${rel(file)}`, () => {
    assert.ok(schemaFor(rel(file)), 'file name must match a schema (manifest.yaml, sync.yaml, ...)');
    assert.deepEqual(validateFile(file), []);
  });
}

// The v0.1 example, kept as it was before the example moved to v0.2.
const v01Dir = join(fixtures, 'v0.1', 'bistro-booking');

for (const file of yamlFiles(v01Dir)) {
  test(`v0.1 example ${rel(file)} is valid as v0.1`, () => {
    assert.equal(parse(readFileSync(file, 'utf8')).spec_version, '0.1');
    assert.ok(schemaFor(rel(file)));
    assert.deepEqual(validateFile(file), []);
  });
}

test('the v0.1 example keeps every file, including its register and anchors', () => {
  for (const f of ['compliance.yaml', 'anchors.yaml', 'documents/register.md', 'declared/crm/manifest.yaml',
    'processings/marketing-emails/processing.yaml', 'processings/table-bookings/processing.yaml',
    'services/bistro-api/manifest.yaml', 'services/bistro-api/sync.yaml', 'services/bistro-web/manifest.yaml', 'services/bistro-web/sync.yaml']) {
    assert.ok(existsSync(join(v01Dir, f)), f);
  }
});

// The release whose tag each schema folder's $id names: v0.1 is frozen at v0.1.0; v0.2 grows by additive patch releases.
const releases = { '0.1': '0.1.0', '0.2': '0.2.1' };

test('schema $id matches the published URL of its release, for each version', () => {
  assert.deepEqual(Object.keys(releases), VERSIONS);
  for (const version of VERSIONS) {
    for (const name of SCHEMAS.filter((s) => hasSchema(version, s))) {
      const schema = JSON.parse(readFileSync(join(root, 'schema', `v${version}`, `${name}.schema.json`), 'utf8'));
      assert.equal(schema.$id, `https://raw.githubusercontent.com/C2-POLY/compliance-spec/v${releases[version]}/schema/v${version}/${name}.schema.json`);
      assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
      assert.deepEqual(schema.properties.spec_version, { const: version });
    }
  }
});

test('the manifest spec example is the v0.2 bistro-api example; the v0.1 fixture is the v0.1 bistro-api example', () => {
  const example = readFileSync(join(root, 'examples', 'bistro-booking', 'services', 'bistro-api', 'manifest.yaml'), 'utf8');
  const spec = readFileSync(join(root, 'spec', 'manifest.md'), 'utf8');
  const block = spec.split('## Worked example')[1]?.match(/```yaml\n([\s\S]*?)```/)?.[1];
  assert.equal(block, example);
  assert.equal(parse(example).spec_version, '0.2');
  const fixture = readFileSync(join(fixtures, 'valid', 'manifest', 'bistro-api.yaml'), 'utf8');
  assert.equal(readFileSync(join(v01Dir, 'services', 'bistro-api', 'manifest.yaml'), 'utf8'), fixture);
});

test('the validator picks the schema from the file\'s own spec_version', () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'compliance-version-'));
  const v02 = readFileSync(join(fixtures, 'valid', 'manifest', 'v0.2', 'all-new-fields.yaml'), 'utf8');
  const asV01 = join(tmpDir, 'manifest.yaml');
  writeFileSync(asV01, v02.replace('spec_version: "0.2"', 'spec_version: "0.1"'));
  const errors = validateFile(asV01);
  assert.ok(errors.some((e) => e.keyword === 'additionalProperties'), 'v0.2 fields are rejected in a v0.1 file');
  assert.ok(errors.some((e) => e.instancePath === '/personal_data/0/fields/1/category' && e.keyword === 'enum'), 'connection is a v0.2 category');
});

test('validate.mjs CLI checks a v0.1 and a v0.2 file in one run', () => {
  const result = spawnSync(process.execPath, [join(root, 'scripts', 'validate.mjs'),
    join(v01Dir, 'compliance.yaml'), join(root, 'examples', 'bistro-booking', 'compliance.yaml')], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stdout);
  assert.equal(result.stdout.match(/^ok {4}/gm).length, 2);
});

const missingServices = (dir) =>
  spawnSync(process.execPath, [join(root, 'scripts', 'missing-services.mjs'), dir], { encoding: 'utf8' });

test('missing-services reports the repo without a services folder and exits 1', () => {
  const result = missingServices(join(fixtures, 'repos', 'missing'));
  assert.equal(result.status, 1);
  assert.match(result.stdout, /^missing: bistro-web /m);
  assert.doesNotMatch(result.stdout, /bistro-api|bistro-analytics/);
});

test('missing-services exits 0 on the Bistro Booking examples, v0.2 and v0.1', () => {
  for (const dir of [join(root, 'examples', 'bistro-booking'), v01Dir]) {
    const result = missingServices(dir);
    assert.equal(result.status, 0);
    assert.equal(result.stdout, '');
  }
});

// Compliance step (skills/compliance-step)
const stepDir = join(root, 'skills', 'compliance-step');
const manifestSchema = JSON.parse(readFileSync(join(root, 'schema', 'v0.2', 'manifest.schema.json'), 'utf8'));
const processingSchema = JSON.parse(readFileSync(join(root, 'schema', 'v0.2', 'processing.schema.json'), 'utf8'));
const triggersMapping = parse(readFileSync(join(stepDir, 'triggers.yaml'), 'utf8'));
const triggerQuestions = new Map(triggersMapping.triggers.flatMap((t) => t.questions.map((q) => [q.id, { ...q, trigger: t.id }])));
// The compliance-step scenarios start from the v0.2 bistro-api manifest of the example.
const baseManifestFile = join(root, 'examples', 'bistro-booking', 'services', 'bistro-api', 'manifest.yaml');
const baseManifest = parse(readFileSync(baseManifestFile, 'utf8'));
const frontMatter = (file) => parse(readFileSync(file, 'utf8').match(/^---\n([\s\S]*?)\n---/)[1]);
const scenarios = readdirSync(join(stepDir, 'scenarios')).sort();

test('every field path in triggers.yaml exists in the v0.2 manifest or processing schema', () => {
  assert.deepEqual(orphans(triggersMapping, manifestSchema, processingSchema), []);
  assert.equal(baseManifest.spec_version, '0.2');
});

test('check-triggers CLI passes on triggers.yaml', () => {
  const result = spawnSync(process.execPath, [join(root, 'scripts', 'check-triggers.mjs')], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stdout);
});

test('check-triggers reports a bogus field path', () => {
  const mapping = {
    triggers: [{ id: 'z', questions: [
      { id: 'z1', field: 'processors[].name' },
      { id: 'z2', field: 'processors[].colour' },
      { id: 'z3', field: 'personal_data[].fields[].category', also: ['storage[].retention.nope'] },
      { id: 'z4', field: 'notices[].kind', also: ['ai_features[].risk.level'], processing: ['legal_basis_detail.consent', 'legal_basis_detail.colour'] },
    ] }],
  };
  assert.deepEqual(orphans(mapping, manifestSchema, processingSchema),
    ['z2: processors[].colour', 'z3: storage[].retention.nope', 'z4: processing legal_basis_detail.colour']);
  const v01 = JSON.parse(readFileSync(join(root, 'schema', 'v0.1', 'manifest.schema.json'), 'utf8'));
  assert.deepEqual(orphans({ triggers: [{ id: 'z', questions: [{ id: 'z5', field: 'notices[].kind' }] }] }, v01), ['z5: notices[].kind']);
});

test('triggers.yaml has six triggers with 2 to 4 questions each, unique ids', () => {
  assert.deepEqual(triggersMapping.triggers.map((t) => t.id), ['a', 'b', 'c', 'd', 'e', 'f']);
  for (const t of triggersMapping.triggers) assert.ok(t.questions.length >= 2 && t.questions.length <= 4, t.id);
  assert.equal(triggerQuestions.size, triggersMapping.triggers.reduce((n, t) => n + t.questions.length, 0));
});

test('there are five scenarios', () => {
  assert.deepEqual(scenarios, ['01-guest-phone', '02-sms-provider', '03-button-colour', '04-assistant-notice', '05-assistant-own-model']);
});

test('compliance-step: a4 asks the legal basis detail, for the processing file, and the step writes v0.2', () => {
  assert.deepEqual(triggerQuestions.get('a4').processing, ['legal_basis_detail.reference', 'legal_basis_detail.balancing_test', 'legal_basis_detail.consent']);
  assert.match(triggerQuestions.get('a4').text, /what supports it/);
  const skill = readFileSync(join(stepDir, 'SKILL.md'), 'utf8');
  assert.match(skill, /spec_version: "0\.2"/);
  assert.match(skill, /Legal basis detail, for the processing file/);
  assert.match(skill, /`processor: <processor id>`/);
  const section = readFileSync(join(stepDir, 'scenarios', '01-guest-phone', 'expected-section.md'), 'utf8');
  assert.match(section, /^  - Legal basis detail, for the processing file: \S/m);
  for (const name of scenarios) assert.equal(parse(readFileSync(join(stepDir, 'scenarios', name, 'expected-manifest.yaml'), 'utf8')).spec_version, '0.2', name);
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
      assert.match(section, /^\*\*Compliance\*\*\n\n(- [^\n]+\n(  - [^\n]+\n)*)+\nManifest: updated in this branch\n$/);
      assert.equal(section.split('\n- ').length - 1, triggers.length);
    }
  });
}

test('scenario 03: the expected manifest is the starting manifest, byte for byte', () => {
  const expected = readFileSync(join(stepDir, 'scenarios', '03-button-colour', 'expected-manifest.yaml'), 'utf8');
  assert.equal(expected, readFileSync(baseManifestFile, 'utf8'));
});

for (const name of ['01-guest-phone', '02-sms-provider', '04-assistant-notice', '05-assistant-own-model']) {
  test(`scenario ${name}: every changed or added item has source spec and the issue url`, () => {
    const dir = join(stepDir, 'scenarios', name);
    const { url } = frontMatter(join(dir, 'issue.md'));
    const expected = parse(readFileSync(join(dir, 'expected-manifest.yaml'), 'utf8'));
    let changed = 0;
    for (const list of ['personal_data', 'storage', 'processors', 'outbound_flows', 'automated_decisions', 'ai_features', 'notices']) {
      const before = new Map((baseManifest[list] ?? []).map((item) => [item.id, item]));
      const after = new Set((expected[list] ?? []).map((item) => item.id));
      for (const id of before.keys()) assert.ok(after.has(id), `${list}/${id} must not be removed`);
      for (const item of expected[list] ?? []) {
        if (JSON.stringify(before.get(item.id)) === JSON.stringify(item)) continue;
        changed += 1;
        assert.deepEqual(item.source, { kind: 'spec', ref: url }, `${list}/${item.id}`);
      }
    }
    assert.ok(changed > 0, 'the scenario must change the manifest');
    assert.deepEqual(expected.service, baseManifest.service);
  });
}

test('scenarios 04 and 05: a notice and an AI role change are written with v0.2 fields', () => {
  const notice = parse(readFileSync(join(stepDir, 'scenarios', '04-assistant-notice', 'expected-manifest.yaml'), 'utf8'));
  assert.deepEqual(notice.notices.map((n) => [n.id, n.kind]), [['assistant-notice', 'screen']]);
  const ai = parse(readFileSync(join(stepDir, 'scenarios', '05-assistant-own-model', 'expected-manifest.yaml'), 'utf8'));
  const feature = ai.ai_features.find((f) => f.id === 'booking-assistant');
  assert.equal(feature.role, 'provider');
  assert.equal(feature.risk.level, 'limited');
  // Every obligation the spec expects for the feature is listed.
  const expected = ['art4-ai-literacy', ...(feature.interacts_with_persons ? ['art50-interaction'] : []), ...(feature.generates_content ? ['art50-synthetic-content'] : [])];
  for (const id of expected) assert.ok(feature.obligations.some((o) => o.id === id), id);
});

// Register template v0.1 (templates/register/register.md.tmpl), checked on the v0.1 example
const exampleDir = v01Dir;
const registerFile = join(exampleDir, 'documents', 'register.md');
const registerText = existsSync(registerFile) ? readFileSync(registerFile, 'utf8') : '';
const registerHead = registerText.match(/^---\n([\s\S]*?)\n---\n/);
// The processing sections, without the Open items summary that comes first.
const registerBody = registerText.replace(/^## Open items\n[\s\S]*?(?=^## )/m, '');
const registerRows = registerBody
  .split('\n')
  .filter((l) => l.startsWith('|') && !/^\| (Item|---)/.test(l))
  .map((l) => l.split(/(?<!\\)\|/).slice(1, -1).map((c) => c.trim()));
const provenance = /^(code: \S+@[0-9a-f]{7}:\S.*|spec: https?:\/\/\S+|declared: \S.*|—)$/;
const placeholders = ['To complete', 'None identified in the sources'];
const itemLabels = [
  '(a) Controller', '(a) Joint controller', '(a) Representative', '(a) Data protection officer', '(b) Purposes',
  '(c) Data subjects', '(c) Personal data', '(d) Recipients', '(e) Transfers', '(f) Erasure time limits', '(g) Security measures',
];

test('register: template and golden output exist, template blocks are balanced', () => {
  const tmpl = readFileSync(join(root, 'templates', 'register', 'register.md.tmpl'), 'utf8');
  assert.ok(existsSync(join(root, 'templates', 'register', 'README.md')));
  assert.ok(registerHead, 'documents/register.md must start with a front matter');
  assert.equal(tmpl.match(/\{\{#each /g).length, tmpl.match(/\{\{\/each\}\}/g).length);
});

test('register: front matter anchors equal anchors.yaml and the sync shas', () => {
  const head = parse(registerHead[1]);
  const anchors = parse(readFileSync(join(exampleDir, 'anchors.yaml'), 'utf8'));
  assert.equal(head.spec_version, '0.1');
  assert.equal(head.generated_at, anchors.generated_at);
  assert.deepEqual(head.anchors, Object.fromEntries(Object.entries(anchors.repos).map(([repo, { sha }]) => [repo, sha])));
  for (const [repo, sha] of Object.entries(head.anchors)) {
    const sync = parse(readFileSync(join(exampleDir, 'services', repo, 'sync.yaml'), 'utf8'));
    assert.equal(sha, sync.sha, `${repo}: anchor must be the sha of sync.yaml`);
  }
});

test('register: every row has three cells and a valid source; placeholders have no source', () => {
  assert.ok(registerRows.length > 0);
  for (const cells of registerRows) {
    assert.equal(cells.length, 3, cells.join(' | '));
    const [, value, source] = cells;
    assert.match(source, provenance, cells.join(' | '));
    assert.equal(placeholders.includes(value), source === '—', cells.join(' | '));
    const code = source.match(/^code: (\S+?)@([0-9a-f]{7}):/);
    if (code) {
      const sync = parse(readFileSync(join(exampleDir, 'services', code[1], 'sync.yaml'), 'utf8'));
      assert.equal(code[2], sync.sha.slice(0, 7), source);
    }
  }
});

test('register: one section per processing, sorted by id, each with the 11 items in order', () => {
  const dirs = readdirSync(join(exampleDir, 'processings')).sort();
  const expected = dirs.map((id) => {
    const p = parse(readFileSync(join(exampleDir, 'processings', id, 'processing.yaml'), 'utf8'));
    return `## ${p.name} (${p.id})`;
  });
  assert.deepEqual(registerBody.match(/^## .+$/gm), expected);
  for (const section of registerBody.split(/^## /m).slice(1)) {
    const labels = section.split('\n').filter((l) => l.startsWith('|') && !/^\| (Item|---)/.test(l))
      .map((l) => l.split(/(?<!\\)\|/)[1].trim()).filter(Boolean);
    assert.deepEqual(labels, itemLabels);
  }
});

test('register: the Open items section comes first and its count is the front matter open_items', () => {
  const head = parse(registerHead[1]);
  const open = registerText.match(/^## Open items\n\n(.+)\n\n\| Processing activity \| Open items \|\n\| --- \| --- \|\n((?:\|.*\n)*)/m);
  assert.ok(open, 'an Open items section with its summary and table');
  assert.ok(registerText.indexOf('## Open items') < registerText.search(/^## (?!Open items)/m));
  const items = open[2].trim().split('\n').map((l) => l.split(/(?<!\\)\|/)[2].trim()).filter((c) => c !== 'None').flatMap((c) => c.split('; '));
  assert.equal(head.open_items, items.length);
  assert.match(open[1], new RegExp(`^${items.length} open items? in \\d+ of the \\d+ processing activit(y|ies)\\.$`));
  assert.doesNotMatch(open[2], /Joint controller|Representative/);
});

// The v0.2 Bistro Booking example (examples/bistro-booking)
const v02Dir = join(root, 'examples', 'bistro-booking');
const readYaml = (...parts) => parse(readFileSync(join(...parts), 'utf8'));
const v02Compliance = readYaml(v02Dir, 'compliance.yaml');
const v02Processings = readdirSync(join(v02Dir, 'processings')).sort().map((id) => readYaml(v02Dir, 'processings', id, 'processing.yaml'));
const manifestOf = (entry) => entry.repo !== undefined
  ? readYaml(v02Dir, 'services', entry.repo, 'manifest.yaml')
  : readYaml(v02Dir, v02Compliance.declared_tools.find((t) => t.id === entry.tool).path);
const v02Manifests = [
  ...v02Compliance.repos.filter((r) => existsSync(join(v02Dir, 'services', r.name))).map((r) => ({ label: r.name, manifest: manifestOf({ repo: r.name }) })),
  ...(v02Compliance.declared_tools ?? []).map((t) => ({ label: t.id, manifest: manifestOf({ tool: t.id }) })),
];

test('v0.2 example: compliance.yaml is v0.2, and the repo mixes v0.1 and v0.2 files', () => {
  assert.equal(v02Compliance.spec_version, '0.2');
  const versions = new Set(yamlFiles(v02Dir).map((f) => parse(readFileSync(f, 'utf8')).spec_version));
  assert.deepEqual([...versions].sort(), ['0.1', '0.2']);
});

test('v0.2 example: every service entry, data, recipient and notice of a processing resolves', () => {
  for (const p of v02Processings) {
    for (const entry of p.services) {
      if (entry.repo !== undefined) assert.ok(v02Compliance.repos.some((r) => r.name === entry.repo), `${p.id}: ${entry.repo}`);
      else assert.ok(v02Compliance.declared_tools.some((t) => t.id === entry.tool), `${p.id}: ${entry.tool}`);
      const m = manifestOf(entry);
      for (const id of entry.data ?? []) assert.ok(m.personal_data.some((d) => d.id === id), `${p.id}: data ${id}`);
      for (const id of entry.recipients ?? []) assert.ok([...m.processors, ...m.outbound_flows].some((r) => r.id === id), `${p.id}: recipient ${id}`);
    }
    for (const n of p.information?.notices ?? []) {
      assert.ok((manifestOf(n).notices ?? []).some((x) => x.id === n.id), `${p.id}: notice ${n.repo ?? n.tool}/${n.id}`);
    }
  }
});

test('v0.2 example: it shows what the design asks for', () => {
  const org = v02Compliance.organisation;
  assert.ok(org.controller.legal_name && org.controller.contact && org.privacy_contact, 'identity complete');
  assert.equal(org.dpo.designated, true);
  assert.equal(org.representative.required, 'unknown');
  const byId = Object.fromEntries(v02Processings.map((p) => [p.id, p]));
  const tb = byId['table-bookings'];
  assert.ok(Array.isArray(tb.joint_controllers) && tb.legal_basis_detail.reference && tb.dpia.ref && tb.information.notices.length > 0);
  assert.ok(Array.isArray(tb.sensitive_data), 'table-bookings fills every DPO check');
  const me = byId['marketing-emails'];
  assert.equal(me.legal_basis_detail, undefined);
  assert.ok([undefined, 'to-assess'].includes(me.dpia?.required));
  assert.ok([undefined, 'to-assess'].includes(me.sensitive_data));
  const all = v02Manifests.map((x) => x.manifest);
  assert.ok(all.some((m) => m.processors.some((r) => r.dpa === 'no')), 'a processor with dpa: no');
  assert.ok(all.some((m) => m.outbound_flows.some((f) => f.processor)), 'a flow linked to its processor');
  assert.ok(all.some((m) => (m.notices ?? []).length > 0), 'a notice');
  const noShow = all.flatMap((m) => m.ai_features).find((f) => f.id === 'no-show-prediction');
  assert.equal(noShow.risk.level, 'limited');
  assert.equal(noShow.obligations.filter((o) => o.status === 'open').length, 1);
  const web = manifestOf({ repo: 'bistro-web' });
  assert.ok(web.service.components.some((c) => c.controller === 'user-of-the-app') && web.service.controller_rationale);
  assert.ok(all.some((m) => m.service.controller !== 'organisation' && !m.service.controller_rationale), 'a missing controller rationale');
});

// Register template v0.2 (templates/register/register.<language>.md.tmpl)
const registerDir = join(root, 'templates', 'register');
const tmplText = (language) => readFileSync(join(registerDir, `register.${language}.md.tmpl`), 'utf8');
const tagsOf = (text) => text.match(/\{\{[^}]*\}\}/g);
const registerReadme = readFileSync(join(registerDir, 'README.md'), 'utf8');
const v02Rules = registerReadme.split('\n## v0.2: the compliance dossier\n')[1] ?? '';
const designActions = {
  'organisation-identity': 'organisation', 'organisation-dpo': 'organisation', 'organisation-representative': 'organisation',
  'joint-controllers': 'organisation', 'personal-data': 'developer', 'transfer-safeguards': 'developer',
  'processor-contracts': 'organisation', retention: 'dpo', 'security-measures': 'developer', 'legal-basis-detail': 'dpo',
  dpia: 'dpo', information: 'organisation', 'sensitive-data': 'dpo', 'ai-classification': 'dpo', 'ai-obligations': 'developer',
  'controller-rationale': 'dpo',
};
const ruleRows = (re) => [...v02Rules.matchAll(re)];
const actionRules = Object.fromEntries(ruleRows(/^\| `([a-z-]+)` \| (organisation|dpo|developer) \| ([^|`]+?) \| ([^|`]+?) \|$/gm)
  .map(([, id, role, en, fr]) => [id, { role, en, fr }]));
const roleLabels = Object.fromEntries(ruleRows(/^\| `(organisation|dpo|developer)` \| ([^|`]+?) \| ([^|`]+?) \|$/gm).map(([, role, en, fr]) => [role, { en, fr }]));
const rowLabels = (table) => ruleRows(/^\| (Organisation|Art\. 30|DPO checks) \| ([^|`]+?) \| ([^|`]+?) \|$/gm)
  .filter(([, t]) => t === table).map(([, , en, fr]) => ({ en, fr }));
const placeLabels = Object.fromEntries(ruleRows(/^\| (Organisation|AI features|Outside the register) \| `([^`]+)` \| `([^`]+)` \|$/gm).map(([, place, en, fr]) => [place, { en, fr }]));
const fixedStrings = Object.fromEntries(ruleRows(/^\| ([a-zA-Z ]+) \| `([^`]+)` \| `([^`]+)` \|$/gm).map(([, key, en, fr]) => [key, { en, fr }]));

test('register v0.2: the English and French templates exist, are balanced and have the same structure', () => {
  const en = tmplText('en');
  const fr = tmplText('fr');
  for (const t of [en, fr]) assert.equal(t.match(/\{\{#each /g).length, t.match(/\{\{\/each\}\}/g).length);
  assert.deepEqual(tagsOf(fr), tagsOf(en));
  assert.equal(fr.split('\n').length, en.split('\n').length);
  const enLines = en.split('\n');
  fr.split('\n').forEach((line, i) => {
    if (/\{\{/.test(line) || /^(---|)$/.test(line) || /^\| (---|\s)/.test(line)) assert.equal(line.replace(/[^{}|]/g, ''), enLines[i].replace(/[^{}|]/g, ''), `line ${i + 1}`);
  });
  assert.match(en, /does not certify compliance/);
  assert.match(fr, /ne certifie pas la conformité/);
  assert.ok(existsSync(join(registerDir, 'register.md.tmpl')), 'the v0.1 template stays');
});

test('register v0.2: the rules list the 16 actions of the design with their role and both labels', () => {
  assert.ok(v02Rules, 'a "## v0.2: the compliance dossier" part');
  assert.deepEqual(Object.fromEntries(Object.entries(actionRules).map(([id, a]) => [id, a.role])), designActions);
  for (const [id, a] of Object.entries(actionRules)) assert.ok(a.en && a.fr && a.en !== a.fr, id);
  assert.deepEqual(Object.keys(roleLabels), ['organisation', 'dpo', 'developer']);
  assert.equal(rowLabels('Organisation').length, 4);
  assert.equal(rowLabels('Art. 30').length, 11);
  assert.deepEqual(rowLabels('Art. 30').map((l) => l.en), itemLabels);
  assert.equal(rowLabels('DPO checks').length, 6);
  assert.deepEqual(Object.keys(placeLabels), ['Organisation', 'AI features', 'Outside the register']);
  assert.equal(fixedStrings['to complete'].fr, 'À compléter');
  assert.equal(fixedStrings['none found'].fr, 'Aucun identifié dans les sources');
  assert.match(registerReadme, /\n## v0\.1: the records of processing\n/);
});

// v0.2.1: one language per dossier, the reserved review, action owners, and the additive-only rule
const v02Actions = readYaml(v02Dir, 'actions.yaml');

test('v0.2.1: actions.yaml takes exactly the action ids of the dossier, and only in v0.2', () => {
  const schema = JSON.parse(readFileSync(join(root, 'schema', 'v0.2', 'actions.schema.json'), 'utf8'));
  assert.deepEqual(schema.$defs.action.enum, Object.keys(designActions));
  assert.deepEqual(schema.properties.contacts.items.properties.role.enum, roleOrder);
  assert.ok(!existsSync(join(root, 'schema', 'v0.1', 'actions.schema.json')), 'v0.1 is frozen');
  assert.equal(schemaFor('examples/bistro-booking/actions.yaml'), 'actions');
});

test('v0.2.1 example: language en, one review, and an actions.yaml whose contacts and scopes resolve', () => {
  assert.equal(v02Compliance.organisation.language, 'en');
  const reviewed = v02Processings.filter((p) => p.review);
  assert.deepEqual(reviewed.map((p) => [p.id, p.review.status]), [['table-bookings', 'validated']]);
  assert.ok(reviewed[0].review.by && reviewed[0].review.date && reviewed[0].review.pr);
  assert.equal(v02Actions.contacts.length, 2);
  assert.equal(v02Actions.assignments.length, 2);
  const repos = v02Compliance.repos.map((r) => r.name);
  for (const c of v02Actions.contacts) for (const s of c.scope ?? []) assert.ok(s === 'organisation' || repos.includes(s), `${c.id}: ${s}`);
  const contacts = new Map(v02Actions.contacts.map((c) => [c.id, c]));
  for (const a of v02Actions.assignments) {
    assert.ok(contacts.has(a.contact), a.contact);
    assert.equal(contacts.get(a.contact).role, designActions[a.action], `${a.action}: the contact answers for its role`);
    assert.ok([undefined, 'organisation', ...repos, ...v02Processings.map((p) => p.id)].includes(a.scope), `${a.action}: ${a.scope}`);
  }
});

test('v0.2.1 stability: the v0.2.0 example files, without the v0.2.1 additions, still validate', () => {
  const dir = mkdtempSync(join(tmpdir(), 'compliance-v020-'));
  let checked = 0;
  for (const file of yamlFiles(v02Dir)) {
    const schema = schemaFor(rel(file));
    if (schema === 'actions') continue;
    const doc = parse(readFileSync(file, 'utf8'));
    if (schema === 'compliance') delete doc.organisation.language;
    if (schema === 'processing') delete doc.review;
    const copy = join(dir, `${checked}.yaml`);
    writeFileSync(copy, stringify(doc));
    assert.deepEqual(validateFile(copy, schema), [], rel(file));
    checked += 1;
  }
  assert.equal(checked, yamlFiles(v02Dir).length - 1);
});

test('v0.2.1: the register uses organisation.language when the generator gets no language', () => {
  const inputs = v02Rules.split('\n### Inputs\n')[1].split('\n### ')[0];
  assert.match(inputs, /`organisation\.language`/);
  assert.match(inputs, /else `en`/);
  assert.match(readFileSync(join(root, 'spec', 'compliance-yaml.md'), 'utf8'), /\| `organisation\.language` \| `en` \\\| `fr` \| no \|/);
  const repoSpec = readFileSync(join(root, 'spec', 'compliance-repo.md'), 'utf8');
  assert.match(repoSpec, /^actions\.yaml +/m);
  assert.match(repoSpec, /\| `actions\.yaml` \| a human \| `actions\.schema\.json` \|/);
  assert.match(repoSpec, /\| `review` \| object \| no \|/);
});

test('v0.2.1 stability: spec/stability.md states the rule and is linked from the README, spec/README.md and CLAUDE.md', () => {
  const stability = readFileSync(join(root, 'spec', 'stability.md'), 'utf8');
  for (const rule of [/renames/, /removes/, /meaning/, /makes an optional field required/, /tightens an enum/, /stays valid/, /v1\.0/, /`spec_version`/]) assert.match(stability, rule);
  assert.match(readFileSync(join(root, 'README.md'), 'utf8'), /\]\(spec\/stability\.md\)/);
  assert.match(readFileSync(join(root, 'spec', 'README.md'), 'utf8'), /\]\(stability\.md\)/);
  assert.match(readFileSync(join(root, '.claude', 'CLAUDE.md'), 'utf8'), /## Stability[\s\S]*spec\/stability\.md/);
});


// The golden files are generated by compliance-action and copied in; until they are, these tests are not defined.
const goldens = [['en', join(v02Dir, 'documents', 'register.md')], ['fr', join(v02Dir, 'documents', 'register.fr.md')]];
const cellsOf = (line) => line.split(/(?<!\\)\|/).slice(1, -1).map((c) => c.trim());
const tableAfter = (text, heading) => {
  const start = text.indexOf(`${heading}\n`);
  assert.ok(start >= 0, `missing ${heading}`);
  const lines = text.slice(start).split('\n');
  const first = lines.findIndex((l) => l.startsWith('| '));
  const rows = [];
  for (const l of lines.slice(first + 2)) { if (!l.startsWith('|')) break; rows.push(cellsOf(l)); }
  return rows;
};
const roleOrder = ['organisation', 'dpo', 'developer'];

for (const [language, file] of goldens) {
  if (!existsSync(file)) continue;
  const text = readFileSync(file, 'utf8');
  const tmpl = tmplText(language);
  const t = (key) => fixedStrings[key][language];
  const placeholders = [t('to complete'), t('none found'), t('not expected')];
  const headings = tmpl.match(/^## (?!\{).+$/gm);
  const subheadings = tmpl.match(/^### .+$/gm);
  const head = parse(text.match(/^---\n([\s\S]*?)\n---\n/)[1]);

  test(`register v0.2 ${language}: front matter, anchors and the fixed text of the template`, () => {
    const anchors = parse(readFileSync(join(v02Dir, 'anchors.yaml'), 'utf8'));
    assert.equal(head.spec_version, '0.2');
    assert.equal(head.language, language);
    assert.equal(head.generated_at, anchors.generated_at);
    assert.deepEqual(head.anchors, Object.fromEntries(Object.entries(anchors.repos).map(([repo, { sha }]) => [repo, sha])));
    for (const [repo, sha] of Object.entries(head.anchors)) assert.equal(sha, readYaml(v02Dir, 'services', repo, 'sync.yaml').sha, repo);
    let at = 0;
    for (const line of tmpl.split('\n').filter((l) => l && !l.includes('{{'))) {
      const found = `\n${text}`.indexOf(`\n${line}\n`, at);
      assert.ok(found >= 0, `template line missing or out of order: ${line}`);
      at = found + 1;
    }
    assert.ok(text.endsWith('\n') && !text.endsWith('\n\n') && !/[ \t]$/m.test(text));
  });

  test(`register v0.2 ${language}: sections in order, one per processing sorted by id`, () => {
    const processingHeadings = v02Processings.map((p) => `## ${p.name} (${p.id})`);
    assert.deepEqual(text.match(/^## .+$/gm), [...headings.slice(0, 2), ...processingHeadings, ...headings.slice(2)]);
    for (const h of processingHeadings) {
      const section = text.split(`${h}\n`)[1].split(/^## /m)[0];
      assert.deepEqual(section.match(/^### .+$/gm), subheadings, h);
    }
  });

  test(`register v0.2 ${language}: three-column tables have valid sources, labels in order, placeholders without source`, () => {
    const check = (rows, labels, where) => {
      assert.deepEqual(rows.map((c) => c[0]).filter(Boolean), labels.map((l) => l[language]), where);
      for (const cells of rows) {
        assert.equal(cells.length, 3, cells.join(' | '));
        const [, value, source] = cells;
        assert.match(source, provenance, cells.join(' | '));
        assert.equal(placeholders.includes(value), source === '—', cells.join(' | '));
        const code = source.match(/^code: (\S+?)@([0-9a-f]{7}):/);
        if (code) assert.equal(code[2], readYaml(v02Dir, 'services', code[1], 'sync.yaml').sha.slice(0, 7), source);
      }
    };
    check(tableAfter(text, headings[0]), rowLabels('Organisation'), 'Organisation');
    for (const p of v02Processings) {
      const section = text.split(`## ${p.name} (${p.id})\n`)[1];
      check(tableAfter(section, subheadings[0]), rowLabels('Art. 30'), p.id);
      check(tableAfter(section, subheadings[1]), rowLabels('DPO checks'), p.id);
    }
  });

  test(`register v0.2 ${language}: actions are known, labelled, sorted, and add up to open_items`, () => {
    const rows = tableAfter(text, headings[1]).map((cells) => {
      assert.equal(cells.length, 4, cells.join(' | '));
      const [, id, label] = cells[0].match(/^`([a-z-]+)`: (.+)$/);
      return { id, label, role: cells[1], count: Number(cells[2]), where: cells[3].split(', ') };
    });
    assert.equal(rows.length, head.actions);
    assert.equal(rows.reduce((n, r) => n + r.count, 0), head.open_items);
    for (const r of rows) {
      assert.ok(actionRules[r.id], r.id);
      assert.equal(r.label, actionRules[r.id][language], r.id);
      assert.equal(r.role, roleLabels[actionRules[r.id].role][language], r.id);
      assert.ok(Number.isInteger(r.count) && r.count > 0, r.id);
      const places = [placeLabels.Organisation[language], ...v02Processings.map((p) => p.id), placeLabels['AI features'][language], placeLabels['Outside the register'][language]];
      assert.deepEqual(r.where, places.filter((pl) => r.where.includes(pl)), `${r.id}: where in document order`);
    }
    const key = (r) => [roleOrder.indexOf(actionRules[r.id].role), -r.count];
    for (let i = 1; i < rows.length; i += 1) {
      const [a, b] = [key(rows[i - 1]), key(rows[i])];
      assert.ok(a[0] < b[0] || (a[0] === b[0] && (a[1] < b[1] || (a[1] === b[1] && rows[i - 1].id < rows[i].id))), `${rows[i - 1].id} before ${rows[i].id}`);
    }
  });

  test(`register v0.2 ${language}: AI features and Outside the register rows are well formed and sorted`, () => {
    const ai = tableAfter(text, headings[2]);
    const outside = tableAfter(text, headings[3]);
    for (const rows of [ai, outside]) {
      for (const cells of rows) {
        assert.equal(cells.length, 6, cells.join(' | '));
        assert.match(cells[5], provenance);
        assert.notEqual(cells[5], '—');
        const code = cells[5].match(/^code: (\S+?)@([0-9a-f]{7}):/);
        if (code) assert.equal(code[2], readYaml(v02Dir, 'services', code[1], 'sync.yaml').sha.slice(0, 7), cells[5]);
      }
    }
    const aiKeys = ai.map((c) => [c[0], c[1].split(': ')[0]]);
    const referenced = new Set(v02Processings.flatMap((p) => p.services.map((e) => e.repo ?? e.tool)));
    const expected = v02Manifests.filter((x) => referenced.has(x.label)).flatMap((x) => x.manifest.ai_features.map((f) => [x.label, f.id]))
      .sort((a, b) => (a[0] === b[0] ? (a[1] < b[1] ? -1 : 1) : (a[0] < b[0] ? -1 : 1)));
    assert.deepEqual(aiKeys, expected);
    const services = outside.map((c) => c[0]);
    assert.deepEqual(services, [...services].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)));
    assert.ok(text.split(`${headings[2]}\n\n`)[1].startsWith(ai.length === 0 ? '' : `${ai.length} `));
    assert.ok(text.split(`${headings[3]}\n\n`)[1].startsWith(outside.length === 0 ? '' : `${outside.length} `));
  });
}

if (goldens.every(([, file]) => existsSync(file))) {
  test('register v0.2: the English and French goldens have the same lines and the same sources', () => {
    const [en, fr] = goldens.map(([, file]) => readFileSync(file, 'utf8'));
    assert.equal(fr.split('\n').length, en.split('\n').length);
    const sources = (text) => text.split('\n').filter((l) => l.startsWith('| ') && !l.startsWith('| ---')).map((l) => cellsOf(l).at(-1)).filter((c) => provenance.test(c));
    assert.deepEqual(sources(fr), sources(en));
  });
}

// Compliance init (skills/compliance-init)

const initDir = join(root, 'skills', 'compliance-init');
const initRepo = join(initDir, 'example', 'repo');
const initExpected = join(initDir, 'example', 'expected');
const initText = (...parts) => readFileSync(join(initDir, ...parts), 'utf8');
const expectedManifestFile = join(initExpected, 'manifest.yaml');
const expectedManifest = parse(readFileSync(expectedManifestFile, 'utf8'));
const manifestLists = ['personal_data', 'storage', 'processors', 'outbound_flows', 'automated_decisions', 'ai_features', 'notices'];
const items = (manifest, list) => manifest[list] ?? [];
const notShipped = /(^|\/)(tests?|__tests__|fixtures?|mocks?|samples?|testdata)\//;

// Git pathspec glob semantics, as the compliance action uses them: `*` stays in a path segment, `**` crosses folders.
function globToRegExp(glob) {
  let out = '';
  for (let i = 0; i < glob.length; i += 1) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') {
      if (glob[i + 2] === '/') { out += '(?:.*/)?'; i += 2; } else { out += '.*'; i += 1; }
    } else if (c === '*') out += '[^/]*';
    else if (c === '?') out += '[^/]';
    else out += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${out}$`);
}
const globMatches = (glob, file) => globToRegExp(glob).test(file);

const splitCells = (line) => line.split(/(?<!\\)\|/).slice(1, -1).map((c) => c.trim());
const findingsText = readFileSync(join(initExpected, 'findings.md'), 'utf8');
const findingRows = findingsText
  .split(/^## /m)
  .slice(1)
  .filter((s) => manifestLists.includes(s.split('\n')[0].trim()))
  .flatMap((s) => s.split('\n').filter((l) => /^\| [PSROADN]\d+ \|/.test(l)).map((l) => ({ section: s.split('\n')[0].trim(), cells: splitCells(l) })));
const findingFiles = (cells) => [...cells[2].matchAll(/`([^`:]+)(?::\d+(?:-\d+)?)?`/g)].map((m) => m[1]);
const allFindingFiles = new Set(findingRows.flatMap(({ cells }) => findingFiles(cells)));
const codeRefs = (manifest) => [manifest.service, ...manifestLists.flatMap((l) => items(manifest, l))]
  .filter((item) => item.source.kind === 'code')
  .flatMap((item) => item.source.ref.split(/\s*,\s*/).map((path) => ({ item: item.id ?? 'service', path })));
const fencedBlocks = (text) => [...text.matchAll(/^```yaml file=(\S+)\n([\s\S]*?)^```$/gm)].map((m) => ({ file: m[1], body: m[2] }));
const tmp = mkdtempSync(join(tmpdir(), 'compliance-init-'));
const validateText = (name, body, schema) => {
  const file = join(tmp, name);
  writeFileSync(file, body);
  return validateFile(file, schema);
};

test('compliance-init: front matter has the name and a one-sentence description', () => {
  const head = frontMatter(join(initDir, 'SKILL.md'));
  assert.equal(head.name, 'compliance-init');
  assert.match(head.description, /^[^\n]+\.$/);
  assert.equal(head.description.split(/\. /).length, 1);
  assert.deepEqual(Object.keys(head).sort(), ['description', 'name']);
});

test('compliance-init: the skill folder holds the files the skill names', () => {
  for (const f of ['SKILL.md', 'scan.md', 'findings.md', 'pr-body.md', 'compliance-handoff.md', 'workflow.yml']) {
    assert.ok(existsSync(join(initDir, f)), f);
  }
  const skill = initText('SKILL.md');
  for (const link of skill.matchAll(/\]\(((?!http)[^)#]+)\)/g)) assert.ok(existsSync(join(initDir, link[1])), `broken link ${link[1]}`);
});

test('compliance-init: the glob matcher follows git pathspec globs', () => {
  assert.ok(globMatches('src/guests/**', 'src/guests/model.ts'));
  assert.ok(globMatches('src/guests/**', 'src/guests/deep/er/x.ts'));
  assert.ok(!globMatches('src/guests/**', 'src/guests.ts'));
  assert.ok(globMatches('src/*.ts', 'src/db.ts'));
  assert.ok(!globMatches('src/*.ts', 'src/guests/model.ts'));
  assert.ok(globMatches('**/*.sql', 'migrations/001.sql'));
  assert.ok(globMatches('**/*.sql', '001.sql'));
  assert.ok(globMatches('package.json', 'package.json'));
  assert.ok(!globMatches('package.json', 'src/package.json'));
});

test('compliance-init: the example repo has the code the findings point at, and a fixture that must not count', () => {
  for (const f of ['src/guests/model.ts', 'src/guests/routes.ts', 'src/notifications/sms.ts', 'src/db.ts', 'src/assistant/suggest.ts', 'migrations/001.sql', 'tests/fixtures/guests.json']) {
    assert.ok(existsSync(join(initRepo, f)), f);
  }
  assert.ok(!allFindingFiles.has('tests/fixtures/guests.json'));
  assert.match(findingsText, /## Not counted[\s\S]*tests\/fixtures\/guests\.json/);
});

test('compliance-init: the expected manifest validates, with the cross-reference checks', () => {
  assert.equal(expectedManifest.spec_version, '0.2');
  assert.deepEqual(validateFile(expectedManifestFile, 'manifest'), []);
});

test('compliance-init: the expected manifest uses the v0.2 fields the code and the answers give', () => {
  const categories = expectedManifest.personal_data.flatMap((d) => d.fields.map((f) => f.category));
  assert.ok(categories.includes('connection'), 'a component served by a host has connection data');
  for (const flow of expectedManifest.outbound_flows) {
    const processor = expectedManifest.processors.find((r) => r.name === flow.to.name);
    if (processor) assert.equal(flow.processor, processor.id, `${flow.id} links its processor`);
  }
  assert.ok(expectedManifest.processors.some((r) => r.dpa_ref), 'dpa_ref from the answers');
  assert.ok(items(expectedManifest, 'notices').length >= 1);
  for (const feature of expectedManifest.ai_features) {
    assert.ok(feature.role && feature.risk?.level, `${feature.id}: role and risk`);
    const expected = ['art4-ai-literacy', ...(feature.interacts_with_persons ? ['art50-interaction'] : []), ...(feature.generates_content ? ['art50-synthetic-content'] : [])];
    assert.deepEqual(feature.obligations.map((o) => o.id).sort(), expected.sort(), `${feature.id}: expected obligations`);
  }
});

test('compliance-init: every code source is an existing file of the example repo, outside tests and fixtures', () => {
  const refs = codeRefs(expectedManifest);
  assert.ok(refs.length >= 10);
  for (const { item, path } of refs) {
    const file = path.replace(/#L\d+(-L?\d+)?$/, '');
    assert.ok(existsSync(join(initRepo, file)), `${item}: ${path} must exist`);
    assert.ok(!notShipped.test(file), `${item}: ${path} must not be a test or fixture`);
    assert.ok(allFindingFiles.has(file), `${item}: ${path} must appear in findings.md`);
  }
});

test('compliance-init: every other source is declared and names who declared it', () => {
  for (const item of [expectedManifest.service, ...manifestLists.flatMap((l) => items(expectedManifest, l))]) {
    if (item.source.kind !== 'code') {
      assert.equal(item.source.kind, 'declared', item.id ?? 'service');
      assert.match(item.source.ref, /answered by .+ during compliance-init/);
    }
  }
});

test('compliance-init: every file of a finding is covered by a root linked_files glob, and every glob matches a file', () => {
  const globs = expectedManifest.linked_files;
  assert.ok(globs.length > 0);
  for (const file of allFindingFiles) {
    assert.ok(globs.some((g) => globMatches(g, file)), `${file} is not covered by linked_files`);
  }
  const repoFiles = readdirSync(initRepo, { recursive: true }).map((f) => f.split('\\').join('/'));
  for (const g of globs) assert.ok(repoFiles.some((f) => globMatches(g, f)), `${g} matches no file`);
  for (const g of globs) assert.ok(!notShipped.test(g) && !g.endsWith('.md'), `${g} must not link tests, fixtures or docs`);
  assert.ok(globs.includes('src/guests/**'), 'a folder with several finding files collapses to dir/**');
});

test('compliance-init: findings rows are well formed and every Becomes resolves in the manifest', () => {
  const ids = findingRows.map(({ cells }) => cells[0]);
  assert.equal(new Set(ids).size, ids.length);
  const questions = [...findingsText.split('## Questions')[1].matchAll(/^\d+\. /gm)].length;
  for (const { section, cells } of findingRows) {
    assert.equal(cells.length, 5, cells.join(' | '));
    assert.ok(['found', 'inferred'].includes(cells[3]), cells[0]);
    assert.ok(findingFiles(cells).length > 0, `${cells[0]} needs a file`);
    for (const target of cells[4].split(/\s*,\s*/)) {
      const ref = target.match(/^(\w+)\/([a-z0-9-]+)$/);
      if (ref) assert.ok(items(expectedManifest, ref[1]).some((item) => item.id === ref[2]), `${cells[0]}: ${target}`);
      else if (target.startsWith('question ')) assert.ok(Number(target.slice(9)) >= 1 && Number(target.slice(9)) <= questions, `${cells[0]}: ${target}`);
      else assert.match(target, /^out: \S/, `${cells[0]}: unknown target ${target}`);
    }
    assert.equal(cells[0][0], {personal_data: 'P', storage: 'S', processors: 'R', outbound_flows: 'O', ai_features: 'A', automated_decisions: 'D', notices: 'N'}[section], cells[0]);
  }
  for (const list of manifestLists) {
    for (const item of items(expectedManifest, list)) {
      if (item.source.kind === 'code') {
        assert.ok(findingRows.some(({ cells }) => cells[4].split(/\s*,\s*/).includes(`${list}/${item.id}`)), `${list}/${item.id} has no finding`);
      }
    }
  }
});

test('compliance-init: no secret value in the example output', () => {
  for (const f of ['findings.md', 'manifest.yaml', 'COMPLIANCE.md', 'pr-body.md', 'answers.md', 'compliance.yml']) {
    const text = readFileSync(join(initExpected, f), 'utf8');
    assert.doesNotMatch(text, /(sk|pk|ghp|tok)[-_][A-Za-z0-9]{10,}|Bearer [A-Za-z0-9]{8,}|postgres:\/\/\S+:\S+@/, f);
  }
  assert.match(findingsText, /a secret is configured via `TEXTFLOW_API_KEY`/);
});

test('compliance-init: the answers file has one answer per question of the findings', () => {
  const questions = [...findingsText.split('## Questions')[1].matchAll(/^(\d+)\. /gm)].map((m) => m[1]);
  const answers = [...readFileSync(join(initExpected, 'answers.md'), 'utf8').matchAll(/^(\d+)\. /gm)].map((m) => m[1]);
  assert.deepEqual(answers, questions);
});

test('compliance-init: COMPLIANCE.md holds a valid v0.2 compliance.yaml with the organisation block, and valid v0.2 processing files', () => {
  const text = readFileSync(join(initExpected, 'COMPLIANCE.md'), 'utf8');
  const blocks = fencedBlocks(text);
  const entry = blocks.filter((b) => b.file === 'compliance.yaml');
  const processings = blocks.filter((b) => /^processings\/[a-z0-9-]+\/processing\.yaml$/.test(b.file));
  assert.equal(entry.length, 1);
  assert.ok(processings.length >= 1);
  assert.equal(blocks.length, entry.length + processings.length);

  assert.deepEqual(validateText('compliance.yaml', entry[0].body, 'compliance'), []);
  const compliance = parse(entry[0].body);
  assert.equal(compliance.spec_version, '0.2');
  assert.deepEqual(Object.keys(compliance.organisation), ['name', 'language', 'controller', 'dpo', 'representative', 'privacy_contact']);
  const repos = compliance.repos;
  assert.ok(Array.isArray(repos) && repos.length === 1);
  assert.equal(repos[0].name, expectedManifest.service.repo.split('/')[1]);
  const noticeIds = new Set(items(expectedManifest, 'notices').map((n) => n.id));

  const dataIds = new Set(expectedManifest.personal_data.map((d) => d.id));
  const recipientIds = new Set([...expectedManifest.processors, ...expectedManifest.outbound_flows].map((r) => r.id));
  const covered = new Set();
  for (const { file, body } of processings) {
    assert.deepEqual(validateText('processing.yaml', body, 'processing'), [], file);
    const p = parse(body);
    assert.equal(p.spec_version, '0.2', file);
    assert.equal(file, `processings/${p.id}/processing.yaml`);
    // Controller and DPO are inherited from compliance.yaml; the DPO checks are left to the DPO, not written.
    for (const key of ['controller', 'dpo', 'legal_basis_detail', 'dpia', 'sensitive_data', 'joint_controllers']) assert.ok(!(key in p), `${file}: ${key}`);
    for (const n of p.information?.notices ?? []) assert.ok(n.repo === repos[0].name && noticeIds.has(n.id), `${file}: notice ${n.id}`);
    assert.match(text, new RegExp(`^### ${p.id}\\n(\\n- [^\\n]+){5}`, 'm'), `${file}: five DPO checks`);
    for (const s of p.services) {
      assert.equal(s.repo, repos[0].name);
      for (const id of s.data ?? []) { assert.ok(dataIds.has(id), `${file}: data ${id}`); covered.add(id); }
      for (const id of s.recipients ?? []) assert.ok(recipientIds.has(id), `${file}: recipient ${id}`);
    }
  }
  for (const id of dataIds) assert.ok(covered.has(id) || /guest-contact/.test(text), `${id} is in no processing`);
  assert.ok(['guest-contact', 'dietary-notes', 'booking-details', 'assistant-questions'].every((id) => covered.has(id)));
});

test('compliance-init: the handoff template has the same shape as the expected file', () => {
  const tmpl = initText('compliance-handoff.md');
  const files = fencedBlocks(tmpl).map((b) => b.file);
  assert.deepEqual(files, ['compliance.yaml', 'processings/<id>/processing.yaml']);
  assert.match(tmpl, /# Compliance handoff: <repo>/);
  assert.match(readFileSync(join(initExpected, 'COMPLIANCE.md'), 'utf8'), /^# Compliance handoff: bistro-api/);
});

test('compliance-init: the pull request body has the three lists, in order, and a checklist', () => {
  const headings = ['## Found in the code', '## Declared by a person', '## Still unknown'];
  for (const text of [initText('pr-body.md'), readFileSync(join(initExpected, 'pr-body.md'), 'utf8')]) {
    const at = headings.map((h) => text.indexOf(`\n${h}\n`) + 1 || text.indexOf(`${h}\n`));
    assert.ok(at.every((i) => i >= 0), headings.join(', '));
    assert.ok(at[0] < at[1] && at[1] < at[2]);
    assert.match(text, /## Reviewer checklist\n\n- \[ \]/);
    assert.match(text, /does not certify compliance/);
  }
  const body = readFileSync(join(initExpected, 'pr-body.md'), 'utf8');
  for (const { cells } of findingRows.filter(({ cells }) => /^(P|S|R|A)/.test(cells[0]))) {
    for (const file of findingFiles(cells)) assert.match(body, new RegExp(file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), file);
  }
});

test('compliance-init: scan.md mentions every manifest section, five stacks and the rules on exclusions and secrets', () => {
  const scan = initText('scan.md');
  for (const key of Object.keys(manifestSchema.properties).filter((k) => k !== 'spec_version')) {
    assert.ok(scan.includes(`\`${key}\``), `scan.md must mention ${key}`);
  }
  for (const stack of ['JS / TS', 'Python', 'Go', 'Rust', 'Swift']) assert.ok(scan.includes(stack), stack);
  for (const word of ['found', 'inferred', 'fixtures', 'vendored', 'Never copy a secret', 'Dev-only files that may hold personal data']) {
    assert.ok(scan.toLowerCase().includes(word.toLowerCase()), word);
  }
});

test('compliance-init: findings.md defines the columns and the template matches the example file', () => {
  const format = initText('findings.md');
  assert.match(format, /\| # \| What \| Where \(file:line\) \| Confidence \| Becomes \|/);
  const headings = (text) => text.match(/^## .+$/gm);
  const template = format.match(/````markdown\n([\s\S]*?)````/)[1];
  assert.deepEqual(headings(template), headings(findingsText));
});

const workflowShape = (text) => {
  const wf = parse(text);
  assert.deepEqual(Object.keys(wf.on).sort(), ['pull_request', 'push']);
  assert.deepEqual(wf.on.push.branches, ['main']);
  assert.deepEqual(wf.permissions, { contents: 'read' });
  const { check, send } = wf.jobs;
  assert.equal(check.if, "github.event_name == 'pull_request'");
  assert.equal(send.if, "github.event_name == 'push'");
  assert.equal(send.environment, 'compliance');
  assert.doesNotMatch(JSON.stringify(check), /secrets\.|environment|create-github-app-token|token/);
  assert.match(JSON.stringify(send), /secrets\.COMPLIANCE_APP_PRIVATE_KEY/);
  assert.equal(check.steps.at(-1).with.mode, 'check');
  assert.equal(send.steps.at(-1).with.mode, 'send');
  assert.equal(send.steps.find((s) => s.uses?.startsWith('actions/checkout')).with['fetch-depth'], 0);
  for (const step of [...check.steps, ...send.steps]) assert.match(step.uses, /^[\w.-]+\/[\w.-]+@<full-sha>$/);
  return wf;
};

test('compliance-init: the workflow checks on pull requests without a secret and sends on push', () => {
  workflowShape(initText('workflow.yml'));
  const wf = workflowShape(readFileSync(join(initExpected, 'compliance.yml'), 'utf8'));
  assert.equal(wf.jobs.send.steps.at(-1).with['compliance-repo'], 'bistro-org/bistro-compliance');
});

test('compliance-init: SKILL.md keeps its promises on git and on the manifest', () => {
  const skill = initText('SKILL.md');
  assert.match(skill, /chore\/compliance-init/);
  assert.match(skill, /Never push to the default branch, never force-push, never merge/);
  assert.match(skill, /\.compliance\/manifest\.yaml/);
  assert.match(skill, /this skill is for a first manifest/);
  assert.match(skill, /does not certify compliance/);
  assert.match(skill, /read-only sub-agent/);
  assert.match(skill, /node "\$\{TMPDIR:-\/tmp\}\/compliance-spec\/scripts\/validate\.mjs" \.compliance\/manifest\.yaml/);
  assert.doesNotMatch(skill, /gh pr merge [^`]|--auto\b/);
});

test('both skills set legal_basis to not-applicable when the user of the app is the controller', () => {
  const rule = /`user-of-the-app`[^\n]*`legal_basis: not-applicable/;
  assert.match(initText('SKILL.md'), rule);
  assert.match(readFileSync(join(stepDir, 'SKILL.md'), 'utf8'), /`user-of-the-app`, do not ask a4[^\n]*`legal_basis: not-applicable`/);
  assert.match(readFileSync(join(stepDir, 'triggers.md'), 'utf8'), /Not asked when `service.controller` is `user-of-the-app`/);
  assert.match(readFileSync(join(root, 'spec', 'manifest.md'), 'utf8'), /`user-of-the-app`[^\n]*legal bases are `not-applicable`/);
});

test('compliance-init: the skills README lists it next to compliance-step', () => {
  const readme = readFileSync(join(root, 'skills', 'README.md'), 'utf8');
  assert.match(readme, /## compliance-init/);
  assert.match(readme, /compliance-init\/SKILL\.md/);
  assert.match(readFileSync(join(root, 'README.md'), 'utf8'), /skills\/compliance-init/);
});

test('compliance-init: every AI feature and decision of the findings is in the manifest, never dropped', () => {
  for (const [section, list] of [['ai_features', 'ai_features'], ['automated_decisions', 'automated_decisions']]) {
    const rows = findingRows.filter((r) => r.section === section);
    for (const { cells } of rows) {
      const ids = cells[4].split(/\s*,\s*/).filter((t) => t.startsWith(`${list}/`)).map((t) => t.split('/')[1]);
      assert.ok(ids.length > 0, `${cells[0]} must become a ${list} item`);
      for (const id of ids) assert.ok(expectedManifest[list].some((i) => i.id === id), `${list}/${id} missing from the manifest`);
    }
    assert.ok(rows.length === 0 ? expectedManifest[list].length === 0 : expectedManifest[list].length >= rows.length, `${list}: [] only means none found`);
  }
  assert.ok(expectedManifest.ai_features.length >= 1);
});

test('compliance-init: questions are one per topic, the controller is first, and answers list their items', () => {
  const questions = findingsText.split('## Questions')[1].split('\n').filter((l) => /^\d+\. /.test(l));
  assert.match(questions[0], /^1\. Controller \(blocking\)/);
  const answers = readFileSync(join(initExpected, 'answers.md'), 'utf8');
  assert.match(answers, /^1\. Controller: the organisation/m);
  for (const topic of ['Legal basis', 'Retention', 'Country', 'Data processing agreement', 'Account used']) {
    assert.match(answers, new RegExp(`^\\d+\\. ${topic}[^\\n]*:\\n(   - [\\w-]+: .+\\n)+`, 'm'), topic);
  }
  assert.ok(questions.length <= 10);
  const skill = initText('SKILL.md');
  assert.match(skill, /do not write `\.compliance\/manifest\.yaml` to disk until the controller question/);
  assert.match(skill, /one question per topic/);
  assert.equal(expectedManifest.service.source.kind, 'declared');
});

test('compliance-init: the skill states the retention, flow, conservative-default, handoff and pin rules', () => {
  const skill = initText('SKILL.md');
  const scan = initText('scan.md');
  assert.match(scan, /`duration: none`/);
  assert.match(scan, /`session` is for memory only/);
  assert.match(skill, /`session` is only for data held in memory/);
  assert.match(scan, /`data: \[\]`/);
  assert.match(skill, /`human_review: false`, `legal_or_similar_effect: true`/);
  assert.match(skill, /ai_features: \[\]` and `automated_decisions: \[\]` mean only that none was found/);
  assert.match(skill, /whose account/i);
  assert.match(skill, /user-of-the-app/);
  assert.match(initText('compliance-handoff.md'), /user-of-the-app[\s\S]*Art\. 30/);
  assert.match(initText('compliance-handoff.md'), /No `controller` and no `dpo`/);
  assert.match(skill, /`spec_version: "0\.2"`/);
  assert.match(skill, /category `connection`/);
  assert.match(skill, /`service\.controller_rationale`/);
  assert.match(skill, /`service\.privacy_by_design`/);
  assert.match(skill, /`role: to-assess` and `risk: \{level: to-assess\}`/);
  assert.match(skill, /never asked: they go to the handoff as items for the DPO/);
  assert.match(scan, /## 9\. `service`, `notices` and `linked_files`/);
  assert.match(skill, /commits\/<tag> --jq \.sha/);
  assert.match(skill, /annotated/);
  assert.match(skill, /TODO/);
  assert.match(initText('workflow.yml'), /TODO: pin to the commit of the v1 tag/);
  assert.match(skill, /at least half of the files of that folder/);
  assert.match(initText('findings.md'), /out: <reason>/);
  assert.match(initText('pr-body.md'), /## To confirm/);
  assert.match(readFileSync(join(initExpected, 'pr-body.md'), 'utf8'), /## To confirm/);
});

test('compliance-init: a dir/** link covers at least half of the files of its folder', () => {
  const repoFiles = readdirSync(initRepo, { recursive: true }).map((f) => f.split('\\').join('/')).filter((f) => /\.\w+$/.test(f));
  for (const g of expectedManifest.linked_files.filter((x) => x.endsWith('/**'))) {
    const inFolder = repoFiles.filter((f) => globMatches(g, f));
    const found = inFolder.filter((f) => allFindingFiles.has(f));
    assert.ok(found.length * 2 >= inFolder.length, `${g}: ${found.length} of ${inFolder.length}`);
  }
});

test('v0.2.1 skills: compliance-init asks the dossier language with the compliance repo; compliance-step keeps it', () => {
  const init = initText('SKILL.md');
  assert.match(init, /dossier language/);
  assert.match(init, /`organisation\.language`/);
  assert.match(initText('compliance-handoff.md'), /^  language: <en or fr>$/m);
  assert.match(readFileSync(join(stepDir, 'SKILL.md'), 'utf8'), /language the manifest already uses/);
});
