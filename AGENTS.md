# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Project workflow

- Use `docs/superpowers/specs/2026-09-07-zakkuri-calendar-mvp-design.md` as the MVP product and architecture source of truth.
- When a task has an approved implementation plan, follow the matching file under `docs/superpowers/plans/`.
- Keep UI components free of SQLite and business-rule access. Put interaction and orchestration in feature custom hooks, domain rules in `src/domain`, SQLite implementations in `src/data/sqlite`, feature UI in `src/features`, and only genuinely cross-screen UI in `src/shared/components`.
- Implement features and fixes with tests first. Before reporting completion, run the relevant tests plus the repository-wide typecheck, lint, format check, and test commands that exist at that point.
- Create isolated worktrees with `git gtr`, never with `git worktree add`. Start ordinary task branches from `origin/develop` and open PRs against `develop`.
- Keep equivalent workflow skills under `.agents/skills` and `.claude/skills` aligned when either copy changes.

# Project skills

Use the matching skill when the request falls within its scope:

- `worktree-setup`: create an isolated task worktree with `git gtr`.
- `post-merge-cleanup`: clean a merged task's worktree and local branch safely.
- `db-schema-change`: add or change SQLite schema, migrations, seeds, or repositories.
- `create-issue`: create a repository GitHub Issue.
- `add-screen`: add or substantially restructure an Expo Router screen.
- `add-setting`: add a persisted user-facing setting.
- `pr-review`: review a PR or address review threads.
