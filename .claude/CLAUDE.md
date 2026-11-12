# compliance-spec

The open format (spec, JSON Schemas), the compliance step for `/topic`, the register template and the docs. The GitHub Action lives in C2-POLY/compliance-action.

## House rules

- Everything written in this repo is in English: code, docs, comments, issues, commits, PRs.
- Commit messages and PR titles follow Conventional Commits (`feat:`, `fix:`, `docs:`...). No AI attribution anywhere: no `Co-Authored-By` trailer, no "Generated with" line.
- **Examples use the fictional app « Bistro Booking » only**, a generic restaurant booking app. Never put a real company's name, data, services or repos in this public repo.
- No secret, token or personal data in code, fixtures, logs or examples.
- The project prepares documentation; it never claims to certify compliance.
- Issues live in this repo and in the GitHub Project « Compliance » (C2-POLY). Never `Closes`/`Fixes` in commits or PRs: use `Refs: #n`.
- Base branch: `main`. Every change goes through a pull request.

## Format rules

- Schemas are JSON Schema draft 2020-12, versioned by folder (`schema/v0.1/`). A breaking change gets a new folder, never an edit of a published one.
- Every example and fixture is validated in CI.

## Stability

- From v0.2, every change to the format is additive only ([`spec/stability.md`](../spec/stability.md)): optional fields, sections, files and action ids. Never rename, remove or change the meaning or type of anything, make an optional field required, or tighten an enum. Every valid file stays valid.
- Additions to v0.2 are patch releases (v0.2.x): edit `schema/v0.2/` in place and move every `$id` there to the new tag. A structural change waits for v1.0 and is announced as such.
