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

// Register template (templates/register)
const exampleDir = join(root, 'examples', 'bistro-booking');
const registerFile = join(exampleDir, 'documents', 'register.md');
const registerText = existsSync(registerFile) ? readFileSync(registerFile, 'utf8') : '';
const registerHead = registerText.match(/^---\n([\s\S]*?)\n---\n/);
const registerRows = registerText
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
  assert.deepEqual(registerText.match(/^## .+$/gm), expected);
  for (const section of registerText.split(/^## /m).slice(1)) {
    const labels = section.split('\n').filter((l) => l.startsWith('|') && !/^\| (Item|---)/.test(l))
      .map((l) => l.split(/(?<!\\)\|/)[1].trim()).filter(Boolean);
    assert.deepEqual(labels, itemLabels);
  }
});

// Compliance init (skills/compliance-init)
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

const initDir = join(root, 'skills', 'compliance-init');
const initRepo = join(initDir, 'example', 'repo');
const initExpected = join(initDir, 'example', 'expected');
const initText = (...parts) => readFileSync(join(initDir, ...parts), 'utf8');
const expectedManifestFile = join(initExpected, 'manifest.yaml');
const expectedManifest = parse(readFileSync(expectedManifestFile, 'utf8'));
const manifestLists = ['personal_data', 'storage', 'processors', 'outbound_flows', 'automated_decisions', 'ai_features'];
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
  .flatMap((s) => s.split('\n').filter((l) => /^\| [PSROAD]\d+ \|/.test(l)).map((l) => ({ section: s.split('\n')[0].trim(), cells: splitCells(l) })));
const findingFiles = (cells) => [...cells[2].matchAll(/`([^`:]+)(?::\d+(?:-\d+)?)?`/g)].map((m) => m[1]);
const allFindingFiles = new Set(findingRows.flatMap(({ cells }) => findingFiles(cells)));
const codeRefs = (manifest) => [manifest.service, ...manifestLists.flatMap((l) => manifest[l])]
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
  assert.deepEqual(validateFile(expectedManifestFile, 'manifest'), []);
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
  for (const item of [expectedManifest.service, ...manifestLists.flatMap((l) => expectedManifest[l])]) {
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
      if (ref) assert.ok(expectedManifest[ref[1]]?.some((item) => item.id === ref[2]), `${cells[0]}: ${target}`);
      else if (target.startsWith('question ')) assert.ok(Number(target.slice(9)) >= 1 && Number(target.slice(9)) <= questions, `${cells[0]}: ${target}`);
      else assert.match(target, /^out: \S/, `${cells[0]}: unknown target ${target}`);
    }
    assert.equal(cells[0][0], {personal_data: 'P', storage: 'S', processors: 'R', outbound_flows: 'O', ai_features: 'A', automated_decisions: 'D'}[section], cells[0]);
  }
  for (const list of manifestLists) {
    for (const item of expectedManifest[list]) {
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

test('compliance-init: COMPLIANCE.md holds a valid compliance.yaml entry and valid processing files', () => {
  const text = readFileSync(join(initExpected, 'COMPLIANCE.md'), 'utf8');
  const blocks = fencedBlocks(text);
  const entry = blocks.filter((b) => b.file === 'compliance.yaml');
  const processings = blocks.filter((b) => /^processings\/[a-z0-9-]+\/processing\.yaml$/.test(b.file));
  assert.equal(entry.length, 1);
  assert.ok(processings.length >= 1);
  assert.equal(blocks.length, entry.length + processings.length);

  const repos = parse(entry[0].body);
  assert.ok(Array.isArray(repos) && repos.length === 1);
  assert.equal(repos[0].name, expectedManifest.service.repo.split('/')[1]);
  const doc = `spec_version: "0.1"\norganisation:\n  name: Bistro Booking Group\nrepos:\n${entry[0].body.replace(/^/gm, '  ')}`;
  assert.deepEqual(validateText('compliance.yaml', doc, 'compliance'), []);

  const dataIds = new Set(expectedManifest.personal_data.map((d) => d.id));
  const recipientIds = new Set([...expectedManifest.processors, ...expectedManifest.outbound_flows].map((r) => r.id));
  const covered = new Set();
  for (const { file, body } of processings) {
    assert.deepEqual(validateText('processing.yaml', body, 'processing'), [], file);
    const p = parse(body);
    assert.equal(file, `processings/${p.id}/processing.yaml`);
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
