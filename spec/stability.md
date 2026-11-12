# Stability

> From v0.2, the format only grows. Manifests, processing files, skills and tools written for v0.2 never need a migration before v1.0.

## The rule

From v0.2, a release only **adds**. It may add:

- an optional field to an existing object;
- an optional section (a list or an object) to an existing file;
- an optional file of the compliance repo, with its schema;
- an action id of the dossier, or a value to an enum whose existing values keep their meaning (a dossier language).

A release never:

- renames a field, a file, an id or an enum value;
- removes one;
- changes its meaning or its type;
- makes an optional field required;
- tightens an enum, a pattern or any other constraint.

So **every valid file stays valid**, and keeps its meaning, in every later release before v1.0.

## Versions

- `spec_version` names the format's major and minor version: `"0.2"`. It never names a patch.
- A patch release (v0.2.1, v0.2.2...) only adds optional things to the files of its minor version. Its schemas are edited in place in `schema/v0.2/`, and their `$id` names the release tag (`https://raw.githubusercontent.com/C2-POLY/compliance-spec/v0.2.1/schema/v0.2/<name>.schema.json`). A file that uses an addition keeps `spec_version: "0.2"`; validate it with the schemas of that release or a later one, since an older schema rejects unknown keys.
- A minor release (v0.3) gets its own folder and `spec_version`, and follows the same rule: a valid v0.2 file stays valid, and becomes a v0.3 file by changing its `spec_version` only.
- `schema/v0.1/` is frozen at v0.1.0. v0.1 files stay valid.
- The generator ignores what it does not read yet. A new field may be reserved before the dossier shows it, as `review` and `actions.yaml` are in v0.2.1.

## Structural changes

A change the rule does not allow (a rename, a removal, a new meaning, a new required field, a tighter constraint) waits for **v1.0**. It is announced as such: the issue that proposes it says so, and the v1.0 release lists every structural change with the migration it needs. Until then, a need is met by an addition, or it waits.

## Releases

| Release | Added |
| --- | --- |
| v0.2.0 | The compliance dossier: organisation identity, DPO checks, notices, AI Act role, risk and obligations. |
| v0.2.1 | `organisation.language` ([compliance-yaml.md](compliance-yaml.md#language-v021)), the reserved `review` of a processing and the optional `actions.yaml` ([compliance-repo.md](compliance-repo.md)), and this rule. |

## How a change is checked

- Its pull request names the additions it makes, against the list above.
- `npm test` validates the examples and fixtures, and checks that the v0.2.0 example files, without the later additions, still validate.
