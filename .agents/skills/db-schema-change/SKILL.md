---
name: db-schema-change
description: Use when adding or changing zakkuri-calendar SQLite tables, columns, indexes, migrations, seeds, row mappings, or repository persistence.
---

# SQLite schema change

Read the exact Expo SDK 57 SQLite documentation and the database sections of the current approved design and implementation plan before editing.

1. Inspect `src/domain`, `src/data/sqlite`, their tests, and the current schema documentation. Do not assume another project's schema or helper exists.
2. Add a failing test for the migration, seed, mapper, or repository behavior before implementation.
3. Keep domain entities and repository contracts free of Expo and SQLite imports. Keep SQL, rows, and serialization inside `src/data/sqlite`; UI and feature hooks must not receive raw rows or a raw database handle.
4. Put ordered, one-time schema changes in `src/data/sqlite/migrations.ts`. Track applied versions in `schema_migrations`, execute each migration transactionally, and make startup/seed orchestration safe to run repeatedly.
5. Use bound parameters for every runtime value. Use developer-authored SQL directly only for fixed schema statements. Use the transaction handle passed to the exclusive transaction callback.
6. Validate database rows and serialized configuration at the mapping boundary. Return safe errors without exposing stored raw values.
7. Update repository implementations, domain contracts, and storage documentation in the same change when affected. Destructive migrations require an explicit data migration design and user approval.
8. Verify focused tests first, then all available typecheck, lint, format-check, and test commands. A mocked test does not prove simulator/device SQLite behavior; report native smoke checks separately.
