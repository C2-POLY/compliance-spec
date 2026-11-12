# Scan guide

How to read an existing codebase and record what it does with personal data. The result is `.compliance/findings.md`, in the format of [`findings.md`](findings.md). A scan only reports what the code shows; it never fills a gap with a likely value.

The scan can be long on a large repo. Hand it to a read-only sub-agent (it needs Read, Grep, Glob and read-only Bash, nothing that writes), give it this file and `findings.md`, and ask for the findings file back as text. The main session then drafts the manifest from it.

## 1. Method

1. **Orient.** Read the README, the package manifest (`package.json`, `pyproject.toml` / `requirements.txt`, `go.mod`, `Cargo.toml`, `Package.swift` or the Xcode project) and the entry points (`main.*`, `index.*`, `app.*`, `server.*`, `cmd/`, `src/bin/`, the `@main` type). Note what the service is (for `service`), whether the repo holds several deliverables (apps, workers, packages: they become `service.components`), and the git remote (`git remote get-url origin`, for `service.repo`).
2. **List the files that ship.** `git ls-files` gives the tracked files. Drop what [never counts](#6-what-never-counts) before searching, with a pathspec:

   ```
   git grep -n -I -i -E '<pattern>' -- . ':!**/tests/**' ':!**/test/**' ':!**/__tests__/**' ':!**/fixtures/**' ':!**/mocks/**' ':!**/vendor/**' ':!**/node_modules/**' ':!**/dist/**' ':!**/build/**' ':!**/target/**' ':!**/*.lock' ':!package-lock.json'
   ```

   `git grep` is fast and skips untracked and ignored files. Outside git, use `grep -rnIiE` with `--exclude-dir`.
3. **Search by section**, in the order of [section 2 to 5](#2-personal_data), then the notices of [section 9](#9-service-notices-and-linked_files), with the patterns below. Start from the entry points and the data layer (models, migrations, the HTTP and SDK clients) and follow imports from there; a name hit in a file nobody imports is weak.
4. **Read every hit** around its line before recording it. A regex hit is a lead, not a finding.
5. **Record** each finding with its file and line, what was seen, a confidence and what it becomes in the manifest ([`findings.md`](findings.md)).
6. **Then list the gaps** as questions: what the code cannot tell (see [section 8](#8-what-the-code-cannot-tell)).

### Confidence

| Value | Meaning | Examples |
| --- | --- | --- |
| `found` | The code shows it directly: you can point at the line. | A `phone` column; a call to an HTTP endpoint; a `Command::new("git")`; a table with no delete anywhere is **not** found (see `inferred`). |
| `inferred` | Deduced from what the code shows. Say what it was deduced from, in `What`. | The purpose, from the README or a function name; "the account is the organisation's" because the key comes from an env var; "retention is unknown" because no deletion or expiry exists; a category from a field name that is not obvious. |

A finding that is neither is not a finding: it is a question.

## 2. `personal_data`

Anything that identifies or concerns a person. Look at where data is defined, collected and sent.

| Signal | Where to look |
| --- | --- |
| Models, structs, types naming a person's attributes | ORM models, DTOs, protobuf / OpenAPI schemas, `Codable` structs |
| Migrations and schema files | `migrations/`, `db/migrate/`, `alembic/versions/`, `*.sql`, `schema.prisma`, `*.xcdatamodeld` |
| Forms and request bodies | validation schemas, form components, API request and response types |
| Fields that carry personal data without a model | analytics and log properties, query strings, headers, cookies, JWT claims |
| User-supplied content | free text, uploads, files read from the user's disk |

Field names worth a search (case-insensitive): `email|e_mail|phone|mobile|tel\b|first_?name|last_?name|full_?name|display_?name|username|birth|dob|age\b|gender|address|street|postcode|zip|city|country|ip_?addr|lat\b|lng|latitude|longitude|gps|location|device_?id|user_?agent|avatar|photo|picture|passport|national_?id|iban|card|pan\b|payment|customer_?id|salary|employer|health|allerg|diet|religion|password|passwd|hash|token|secret`.

| Stack | Definitions to read |
| --- | --- |
| JS / TS | `interface` or `type` named `User`, `Guest`, `Customer`, `Profile`, `Account`, `Member`, `Employee`; Prisma `model X {`; TypeORM `@Entity` / `@Column`; Sequelize `define(`; Drizzle `pgTable(` / `sqliteTable(`; Mongoose `new Schema(`; `zod` / `yup` / `joi` objects; `<input type="email|tel">`, `autocomplete=` |
| Python | Django `models.Model`; SQLAlchemy `Column(` / `mapped_column(`; `pydantic.BaseModel`; `@dataclass`; Alembic revisions; `forms.EmailField` |
| Go | `struct` with tags `json:"email"`, `db:"phone"`, `gorm:"..."`; `sqlx` queries; `.proto` messages; `goose` / `migrate` SQL files |
| Rust | `struct` deriving `Serialize` / `Deserialize` / `FromRow`; `sqlx::query!`; Diesel `table!` / `schema.rs`; `serde(rename = ...)` |
| Swift | `struct X: Codable`; SwiftData `@Model`; Core Data model files; `UserDefaults`; `@AppStorage`; `CNContact`, `CLLocation`, `HKHealthStore` and other system APIs that read personal data |

**Category** (the manifest's closed list): `identity` (name, login, any identifier), `contact` (email, phone, postal address), `financial`, `location`, `usage` (behaviour, history, scores, timestamps), `professional`, `connection` (IP address, user agent and other technical headers, device identifiers), `health`, `special` (Art. 9 data, or free text that may reveal it: a dietary note can), `credential` (password, hash, token, key), `unknown` (content whose nature the service cannot know: user files, free text). Do not invent a category: use `unknown`.

**Connection data.** A component that persons reach over the network (a web API, a site: `app.listen`, `http.ListenAndServe`, route handlers, a `Dockerfile` `EXPOSE`) is served by a host that sees their IP address and headers; a component that runs on the person's device (a desktop, mobile or browser app) and calls a third party shows that party the person's IP address. Either way, record a `personal_data` entry of category `connection` (`inferred`, from the file that serves the requests or makes the call), even when nothing in the code stores it. Also record the code that reads it on purpose (`req.ip`, `X-Forwarded-For`, `user-agent`, rate limiters, device ids): that is `found`.

One `personal_data` entry per set of data collected for the same purpose. The purpose is read from the README or the code that uses the data and is `inferred`; the legal basis is never read from code (it becomes a question).

## 3. `storage`

Where personal data rests, and any hint of how long.

| Kind (`storage[].kind`) | Signals |
| --- | --- |
| `database` | `DATABASE_URL`, `postgres://`, `mysql://`, `mongodb://`, `sqlite:`; packages and modules `pg`, `mysql2`, `mongoose`, `better-sqlite3`, `psycopg`, `sqlalchemy`, `django.db`, `sqlx`, `gorm`, `diesel`, `rusqlite`, `GRDB`, `SQLite.swift`, Core Data (`NSPersistentContainer`), SwiftData (`ModelContainer`) |
| `object-storage` | S3-compatible or cloud bucket clients (`S3Client`, `boto3.client("s3")`, `storage.Client`, `put_object`, `PutObject`, `upload`) |
| `cache` | `redis://`, `ioredis`, `memcached`, `lru-cache`, `functools.lru_cache` on personal data, `NSCache` |
| `file` | `fs.writeFile`, `fs.appendFile`, `open(..., "w")`, `os.WriteFile`, `std::fs::write`, `File::create`, `FileManager.default.urls(for: .applicationSupportDirectory`, `~/Library/`, `XDG_CONFIG_HOME`, `dirs::config_dir`, `dirs::data_dir`, `os.UserConfigDir`, `appdirs`, a JSON or SQLite file in the user's home |
| `file` (temporary) | `os.tmpdir()`, `tempfile.`, `os.CreateTemp`, `tempfile::`, `NSTemporaryDirectory`, `/tmp/` |
| `keychain` | `SecItemAdd`, `kSecClass`, `KeychainAccess`, `keyring`, `keytar`, `security add-generic-password`, `Entry::new` (keyring crate), Credential Manager |
| `browser` | `localStorage`, `sessionStorage`, `document.cookie`, `indexedDB`, `Set-Cookie` |
| `memory` | personal data held only in process memory (state, singletons) when nothing else stores it |
| `log` | `console.log|error`, `logger.`, `logging.`, `log.Printf`, `slog.`, `println!`, `tracing::`, `NSLog`, `os_log`, `print(` **with a person attribute in the message**; log shippers and error trackers (also a processor) |
| `backup` | `pg_dump`, snapshot or backup jobs, cron files |
| `other` | queues with persistence, search indexes |

**Retention hints.** Look for expiry and deletion: `ttl`, `expire`, `EX `, `maxAge`, `max-age`, `expires_at`, `DELETE FROM`, `.delete(`, `.remove(`, `unlink`, `purge`, `prune`, `cleanup`, `retention`, `logrotate`, `ON DELETE CASCADE`, sign-out and logout handlers, "remove" buttons and commands, cron or scheduler definitions. Then choose the value:

| What the code shows | `retention` | `source` |
| --- | --- | --- |
| A TTL, expiry or purge with a delay | `duration`: that delay as an ISO 8601 duration (`PT12H`, `P30D`), `trigger`: the event that starts it | `code` |
| An event that deletes the data and no delay: sign-out deletes the token, the user removes an entry, uninstalling | `duration: none` (kept until that event) and `trigger`: the event, in words ("sign-out", "the user removes the repository from the list") | `code` |
| Data held only in process memory | `duration: session` | `code` |
| Nothing: no deletion, no expiry anywhere for that store | `duration: unknown`, and a question | `inferred` finding ("no deletion found") |

`session` is for memory only, not for a file or a keychain entry removed at sign-out (that is `none` with a trigger). `unknown` is only for when the code shows nothing. Never put a duration in the manifest that the code does not state and nobody declared.

## 4. `processors` and `outbound_flows`

Anything that sends data out of the process to a third party.

| Signal | Examples |
| --- | --- |
| HTTP clients to a host that is not the service's own | JS / TS: `fetch(`, `axios`, `got`, `node-fetch`, `undici`; Python: `requests.`, `httpx.`, `urllib`, `aiohttp`; Go: `http.Get|Post|NewRequest`, `resty`; Rust: `reqwest`, `ureq`, `hyper`, `surf`; Swift: `URLSession`, `URLRequest`, `Alamofire` |
| SDKs of a provider (payment, email, SMS, analytics, error tracking, storage, search, support chat, auth) | an import or dependency whose name is a provider's, plus a client built with a key |
| Provider environment variables | `*_API_KEY`, `*_TOKEN`, `*_SECRET`, `*_WEBHOOK_URL`, `*_DSN`, `*_ENDPOINT`, `*_CLIENT_ID` in code, `.env.example`, Dockerfiles, CI files |
| Calls to command-line tools that talk to a remote | `gh`, `git` (`clone`, `fetch`, `pull`, `push`, `ls-remote`, remotes), `curl`, `wget`, `ssh`, `scp`, `claude`, the CLI of any provider, run through `child_process.exec|spawn`, `subprocess.run|Popen`, `exec.Command`, `std::process::Command`, `Process()` / `NSTask` |
| Webhooks and callbacks the service calls | `webhook`, `callback_url`, `notify_url` |
| Update checks, telemetry, crash reporting, license checks | `releases/latest`, `checkForUpdates`, `SUFeedURL`, `telemetry`, `analytics.track`, the init call of an error tracker, `crash` |
| Mobile and desktop system services | push notification registration, share sheets, `mailto:`, `openURL`, deep links carrying data |
| Email senders | `smtp`, `nodemailer`, `smtplib`, `lettre`, `MFMailComposeViewController` |

For each call, read what data goes in: the body, the query, the arguments, the prompt, the headers. List the `personal_data` ids it carries. A call that sends nothing personal (a static asset, a version check with no identifier) is still recorded if it reveals something (an IP address always does) but as a note, not as a flow with data; when in doubt record it and let the questions settle it.

**Processor or flow only?** An entry in `processors` is a provider **contracted by the organisation**, with a data processing agreement: the key or contract belongs to the organisation (a service key from the environment, in the deployment configuration, or in a secret manager). The same call is also an `outbound_flows` entry with `account: organisation`. A recipient reached with the user's own account or tool (the user's `gh` login, the user's git remotes, the user's calendar, a user-supplied token) is an `outbound_flows` entry only, `account: user`. A plain unauthenticated call is `account: none`. When the code does not tell whose account it is, record `inferred` and ask.

A flow that sends **nothing but the connection** (an update check or a version lookup: only the IP address and the technical headers every HTTP call carries) is still an `outbound_flows` entry, with a `purpose` that says so ("update check; sends only the IP address and the technical headers"). From the person's device, its `data` is the `connection` entry of [section 2](#2-personal_data): the recipient sees the person's IP address. From a server of the organisation, it carries no person's data: `data: []` (the schema allows an empty list). Do not drop it.

When a flow goes to a processor of the same manifest, record the link (`processor: <id>` in the manifest).

Never infer a **country** from a domain name, a TLD or a library. Country, DPA (and where the agreement is: `dpa_ref`) and safeguards are questions.

## 5. `automated_decisions` and `ai_features`

### Decisions about persons

A decision is code that changes what a person gets or can do (price, access, deposit, ban, priority, eligibility, ranking) without a person in the loop. Signals: names and logic around `score`, `rank`, `risk`, `fraud`, `eligib`, `approve|reject|deny|accept`, `block|ban|flag|suspend`, `threshold`, `priority`, `recommend`, `segment`, a conditional on a person attribute that gates a result, a scheduled job that applies the result to many persons. Sorting a list in a screen, a plain validation error or a rate limit is not a decision about a person. Record what the code does (`found`), who is affected, and whether a person can override it before it takes effect (readable from the code when a person must click to apply it: `found` or `inferred`). Whether it has a legal or similarly significant effect is a question; if nobody answers, write `legal_or_similar_effect: true`, the conservative value, and flag it "to confirm". A decision found in the code is never dropped from the manifest.

### AI features

A feature that uses AI that talks to persons or generates content. Signals:

| Signal | Examples |
| --- | --- |
| LLM SDKs, HTTP endpoints and CLIs | packages or modules with `llm`, `ai`, `completion`, `chat`, `embedding` or a model provider's name in them; paths like `/v1/chat/completions`, `/v1/messages`, `/v1/complete`, `/generate`; the `claude` CLI or any LLM CLI run as a subprocess (`claude -p`); `*_API_KEY` of an LLM provider |
| Local models and runtimes | `ollama`, `llama.cpp`, `onnxruntime`, `transformers`, `torch`, `tflite`, `CoreML`, `MLModel`, `NaturalLanguage`, `Vision` framework, model files (`*.onnx`, `*.gguf`, `*.mlmodel`, `*.safetensors`) |
| Prompts | `prompt`, `system:`, `messages: [`, files in `prompts/`, `*.prompt`, `*.md` read into a request |
| Embeddings and search | `embedding`, `vector`, `similarity`, `faiss`, `pgvector` |
| Image, audio, text generation or classification | `generate`, `summarize`, `classify`, `transcribe`, `synthesize` |

For each one, read **from the code** and record as `found` or `inferred`: what personal data goes into the prompt (list the ids); whether a person talks to it (`interacts_with_persons`); whether it produces text, image, audio or video (`generates_content`); and whether the output goes through a person before it is used (`human_review`: a person must click to apply or send it means `true`; a result applied automatically means `false`). Then check whether the interface tells the person it is AI (search UI strings for `AI`, `assistant`, `generated`, `bot`): `marking` is a question unless a string says it. If `human_review` is unclear, ask; if it stays unanswered, write the conservative value `false` and flag it "to confirm". An AI feature found in the code is never dropped from the manifest: `ai_features: []` must only mean "none found". An AI call that sends personal data is also a `processors` / `outbound_flows` entry.

**AI Act role, risk and obligations.** Record what the code hints, as `inferred`, and leave the decision to the answers:

- **Role**: a call to a third party's model API or a packaged model suggests the organisation is a `deployer` of that system; training or fine-tuning a model, or putting the feature into service under the organisation's own name, suggests `provider`. Usually unclear: a question.
- **Risk**: what the feature is used for decides it. A use that decides about persons in hiring, credit, education, essential services, law enforcement or migration (the high-risk list), emotion recognition or biometric categorisation is a strong hint of `high` or worse: record it and ask. A chat assistant or a content generator with no such use suggests `limited`. A question unless a spec states it.
- **Obligations**: list the ones the spec expects (`spec/manifest.md`, `ai_features`), and look for evidence of each: a UI string telling the person they talk to an AI (`art50-interaction`), a label or metadata marking generated content (`art50-synthetic-content`). Found: `done`, with the file in `ref`. Not found: `open`, to confirm. AI literacy (`art4-ai-literacy`) is never in the code: `open`, to confirm.

## 6. What never counts

Do not record a finding from, and do not link, these. List the notable ones in the **Not counted** section of the findings, with the reason, so a reviewer sees they were seen.

| Never counts | Why |
| --- | --- |
| Tests and test helpers (`tests/`, `test/`, `__tests__/`, `*_test.go`, `*.spec.*`, `*.test.*`, `Tests/` in Swift packages) | Not shipped |
| Fixtures, sample, mock, seed and demo data (`fixtures/`, `mocks/`, `samples/`, `seed*`, `*.example.*`, `testdata/`), including data that looks like real people | Fictional by rule; if it looks real, say so in the report to the user, do not copy it |
| Vendored and installed dependencies (`vendor/`, `node_modules/`, `third_party/`, `Pods/`, `.build/`, `target/`, `.venv/`) | Not the service's own code. What matters is the dependency **you import**, recorded from the import |
| Generated code (`dist/`, `build/`, `*.pb.go`, `*.generated.*`, `__generated__/`, `.next/`, lockfiles, minified bundles, API clients generated from a spec) | Read the source it was generated from |
| Dev-only tooling that is not shipped (`scripts/` run by hand, CI files, Makefile, devcontainer, local seeding, one-off migrations scripts, storybook) | Not the running service |
| Documentation and comments | They describe, they do not do. A document that disagrees with the code is a note, the code wins |

**Dev-only files that may hold personal data** (a seed script that loads an export, a script that reads a production dump, a notebook with real rows, a CI job that uploads logs): list them in **Not counted** as a note, with the file, so a person can decide. They are not findings and not `linked_files`.

How to tell what ships: follow the build (`Dockerfile` `COPY`, `package.json` `files` and `main`, the Xcode target membership, `[[bin]]` and `[lib]` in `Cargo.toml`, `go build` targets, a CI release job) rather than guessing from folder names. If you cannot tell, count it and mark it `inferred`.

## 7. Secrets met during the scan

- **Never copy a secret** into the findings, the manifest, the PR, a question or a commit message: no key, token, password, connection string with a password, private key, session cookie.
- Record the **name of the variable and the line**: "a secret is configured via `TEXTFLOW_API_KEY`" (`src/notifications/sms.ts:4`). That sentence is the finding; it shows a provider account exists.
- Do not open `.env`, `.env.*` (except `.env.example`), key files, credential files or cloud config files. If you must know whether one is tracked, `git ls-files | grep -E '(^|/)\.env'` is enough.
- If a real-looking credential is committed in a tracked file, do **not** put its location in anything committed or in the PR. Tell the user in the conversation only: the file and line, "value not shown", and that it should be rotated.
- Personal data met in the repo (a real-looking row in a CSV, a name in a comment) is treated the same way: describe the category in the findings, never the value.

## 8. What the code cannot tell

These always become questions, even when the code has a hint. Ask them in the single message of the skill, and leave the manifest value out or `unknown` until answered:

- the controller (`service.controller`);
- the legal basis of each `personal_data` entry (`legal_basis`), only when the controller is `organisation` or `shared`: with `user-of-the-app`, it is `not-applicable`;
- the real retention of each store, and the event that starts it (`retention`);
- for each processor: the country, whether a DPA is signed (`dpa`), and for a transfer outside the EU the safeguard;
- the region of a database or bucket;
- the country of every recipient (processors and outbound flows), and whose account a flow uses when that is only inferred;
- for each automated decision: legal or similar effect, and human review when the code is unclear;
- for each AI feature: how persons are told it is AI (`marking`), human review when the code is unclear, and its AI Act role and risk level unless a spec states them;
- where persons are told about their data, when the code of a component they use shows no notice;
- where the data processing agreement of each processor is (`dpa_ref`);
- why the organisation is not the controller, when question 1 says so (`service.controller_rationale`).

The controller is the first question and a blocking one: `service.controller` has no `unknown`. A hint from the code (a local app with no server of the organisation suggests `user-of-the-app`) goes in the question; the person decides.

**Not questions for the developer.** The legal basis detail (balancing test, consent records, the contract or law relied on), whether a DPIA is required, the special categories of data and the joint controllers are the DPO's checks. The scan records the hints it sees (a `special` or `health` field, a score about persons, a large volume, a partner that decides with the organisation) in the findings; the skill hands them to the DPO in `.compliance/COMPLIANCE.md` and never asks them.

## 9. `service`, `notices` and `linked_files`

- `service`: `name`, `description` and the repo come from the README, the package manifest and the git remote; `controller` is a question. Several deliverables become `service.components` with a `kind` each, and items name their `component`. When the deliverables differ in who controls the data (a site run by the organisation, an offline app whose data never leaves the device), say so in question 1: a component may get its own `controller`.
- `service.privacy_by_design`: measures the code shows, written as short statements, each `inferred` and to confirm: data kept on the device and never sent ("notes never leave the device"), no account needed, analytics sent only after consent, data minimised or pseudonymised before it is sent (a hash of an id, a truncated IP), encryption of a local store. Written only when a controller is not `organisation` (the manifest expects it there; a person may add it for any service).
- `notices`: where the persons are told about their data. Signals: a privacy or data-protection page or route (`privacy`, `confidentialite`, `datenschutz`, `/legal`, `privacy-policy`), a consent or cookie banner (`consent`, `cookie`, `gdpr`, a consent-management SDK), an onboarding, permission or settings screen whose text speaks of data (`NSLocationWhenInUseUsageDescription` and the other usage strings, an "About your data" screen), an email template with a privacy notice or an unsubscribe link. One `notices` entry each, `kind` `page`, `screen`, `banner` or `email`, `ref` the URL, file or screen name, `found`. None found for a component persons use: a question. A notice that only exists outside the repo (the website of another repo) is an answer, recorded as `declared`.
- `linked_files`: the union of the files of the findings (the `Where` column). Write the files as paths relative to the repo root; collapse to `dir/**` when a folder holds several of them; apply the rule of `SKILL.md` step 6: collapse to `dir/**` only when the findings' files are at least half of that folder's files (2 of 3, 4 of 8) or the folder is a dedicated module; otherwise list the files. Do not link test files, fixtures or documentation.

## 10. Other stacks

For a stack not listed (Java / Kotlin, C#, PHP, Ruby, Elixir, C++, shell), apply the same four searches:

1. **Data layer.** Find the build file and the database dependency, then the model or migration folder. Search the field names of [section 2](#2-personal_data).
2. **Outbound calls.** Find the HTTP client of the stack (its standard library first) and every import of an SDK. Search `http://|https://` literals outside tests, and `*_API_KEY|*_TOKEN|*_URL` variable names.
3. **Disk and keys.** Search the standard file APIs for writes outside the project folder, the platform's key store, and temp files.
4. **Decisions and AI.** Search `score|rank|risk|threshold|approve|reject|block` and the LLM signals of [section 5](#5-automated_decisions-and-ai_features).

Do not stop at the first hit per section: a repo usually has several stores and several recipients, and the last one found is often the one nobody remembered.
