# AGENTS.md

## Scope

These instructions apply to the entire `genealaine-api` repository.

## Project Overview

Genealaine API is a TypeScript and Fastify service backed by PostgreSQL. Business capabilities are organized under `src/modules/`, shared infrastructure belongs under `src/shared/`, database changes are managed through `node-pg-migrate`, and HTTP schemas use TypeBox.

## Working Conventions

- Use English for source code, file names, technical identifiers, test data, and code comments.
- Keep documentation and user-facing text consistent with the language already used in the surrounding file.
- Preserve the module-oriented organization and keep business logic out of route handlers.
- Use repositories for persistence and services for business rules and transaction coordination.
- Keep request and response validation explicit through TypeBox schemas.
- Return API errors using the established RFC 9457 conventions.
- Make database changes through new migrations; do not rewrite an applied migration unless explicitly requested.
- Do not edit generated output in `dist/` directly.
- Add a nearby comment for every regular expression explaining what it matches and what each capture group represents.
- Never introduce real or identifiable family data in fixtures, tests, benchmarks, logs, or documentation; use synthetic or properly anonymized data.

## Tests and Validation

- Keep unit tests close to their domain structure under `test/`.
- Put database-backed tests in the existing integration test directories.
- Run `npm test` for unit tests.
- Run `npm run test:integration` when a change affects persistence, migrations, transactions, or HTTP/database integration and the test database is available.
- Before handing off a change, run `npm run check` when practical.
- If the complete validation cannot be run, report which commands were run and which were omitted.

## Documentation and Decisions

- Keep `docs/roadmap.md` aligned with completed work when a change advances a roadmap item.
- Update the relevant files in `docs/domain/` and `docs/technical/` when behavior or data mappings change.
- Record durable architectural decisions in `docs/adr/`.
- Keep the future OpenAPI contract deterministic and consistent with route schemas.

## Git

- Keep commits focused on one coherent change.
- Use Gitmoji commit messages, starting each commit subject with the appropriate emoji.
