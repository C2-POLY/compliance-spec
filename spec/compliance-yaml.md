# compliance.yaml, v0.1

> Status: draft. Schema: [`schema/v0.1/compliance.schema.json`](../schema/v0.1/compliance.schema.json).

`compliance.yaml` sits at the root of the compliance repo (see [compliance-repo.md](compliance-repo.md)). It lists the repos and the external tools that make up the organisation's information system. It is written by a human.

```yaml
spec_version: "0.1"

organisation:
  name: Bistro Booking Group

repos:
  - name: bistro-api
    url: https://github.com/bistro-org/bistro-api
    owner: platform team
    expected_to_send: true
    components: [api, worker]
  - name: bistro-analytics
    url: https://github.com/bistro-org/bistro-analytics
    owner: data team
    expected_to_send: false

declared_tools:
  - id: crm
    name: ClientDesk CRM
    path: declared/crm/manifest.yaml
```

## Fields

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `spec_version` | string | yes | `"0.1"`. |
| `organisation.name` | string | yes | Name of the organisation. |
| `repos` | list | yes | The repos of the information system. May be `[]`. |
| `declared_tools` | list | no | External tools with a hand-declared manifest. |

`repos[]`:

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `name` | string | yes | Repo name without owner (`^[A-Za-z0-9_.-]+$`). Also the folder name under `services/`. |
| `url` | URI | yes | Where the repo is. |
| `owner` | string | yes | The person or team to ask about it. |
| `expected_to_send` | boolean | yes | `true`: the repo handles personal data and must send a manifest. `false`: a decision was taken that it does not; the line records that decision. |
| `components` | list of ids | no | The component ids the repo's manifest declares, when it holds several deliverables. |

`declared_tools[]`:

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | id | yes | `^[a-z0-9][a-z0-9-]*$`; referenced by `tool:` in processings; equals the folder name under `declared/`. |
| `name` | string | yes | Human name. |
| `path` | string | yes | `declared/<id>/manifest.yaml`. |

## Missing services

A repo with `expected_to_send: true` and no `services/<name>/` folder is **missing**: it was declared as part of the system, but it never sent its manifest (or the Action is not installed). This is detectable from the files alone, without calling GitHub.

```
node scripts/missing-services.mjs <compliance-repo-dir>
```

The script prints one line per missing repo (`missing: <name> (owner: <owner>)`) and exits `1` if there is any, `0` otherwise (`2` if `compliance.yaml` cannot be read). It checks that the folder exists; whether the manifest inside is valid is the job of `validate.mjs`. Run it in the compliance repo's CI to turn a silent gap into a failed check.

`expected_to_send: false` repos are never reported. They stay in the list so that a reviewer sees that the repo was considered.
