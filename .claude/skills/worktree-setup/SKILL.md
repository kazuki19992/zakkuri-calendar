---
name: worktree-setup
description: Use when starting isolated zakkuri-calendar work for a feature, fix, documentation task, or release preparation. Requires git gtr and an origin/develop base for ordinary work.
---

# Worktree setup

Create task worktrees with `git gtr new`, not `git worktree add`.

1. Run from the main repository and check for collisions:

   ```bash
   git status --short --branch
   git gtr list
   git branch --list 'claude/<task-name>'
   ```

   If the main checkout has unrelated changes that make setup unsafe, stop and report them. If the target branch already has a worktree, reuse it instead of creating another.

2. Confirm the configured location. The committed `.gtrconfig` should resolve to `.worktrees`:

   ```bash
   git gtr config get gtr.worktrees.dir
   ```

3. Create a Claude Code branch from the latest remote development branch:

   ```bash
   git fetch origin develop
   git gtr new claude/<task-name> --from origin/develop --yes
   ```

4. Resolve and verify the new worktree:

   ```bash
   WORKTREE_PATH="$(git gtr go claude/<task-name>)"
   git -C "$WORKTREE_PATH" status --short --branch
   ```

5. If `.env.local` exists in the main repository, verify only that it was copied to the new worktree. Never print its contents, guess values, or add it to Git. If the source file does not exist, its absence is not an error.

6. Perform all edits, dependency installation, tests, commits, and pushes inside the new worktree.

Use `post-merge-cleanup` after the PR is confirmed merged.
