---
name: post-merge-cleanup
description: Use after a zakkuri-calendar task PR is reported merged to verify the merge, update develop, and safely remove only that task's clean git gtr worktree and local branch.
---

# Post-merge cleanup

Never delete a worktree based only on a merge report. Resolve the exact PR, branch, and path first.

1. From the main repository, verify the PR and record its branch and merge commit:

   ```bash
   gh pr view <pr-number> --json state,mergedAt,headRefName,baseRefName,mergeCommit
   ```

   Continue only when `state` is `MERGED` and the head branch is the intended task. Ordinary task PRs must target `develop`.

2. Resolve the worktree path and confirm it is clean:

   ```bash
   WORKTREE_PATH="$(git gtr go <head-branch>)"
   git -C "$WORKTREE_PATH" status --porcelain
   ```

   If output is non-empty, stop and report it. Do not use `--force` or discard changes.

3. Update the main checkout without touching other worktrees:

   ```bash
   git fetch origin --prune
   git checkout develop
   git pull --ff-only origin develop
   ```

   Verify the recorded merge commit is an ancestor of updated `develop`.

4. Remove only the resolved task worktree and branch:

   ```bash
   git gtr rm <head-branch> --delete-branch --yes
   ```

   If branch deletion is refused after a verified squash merge, remove the clean worktree first, then delete that exact local branch with `git branch -D` only after rechecking the PR and branch name.

5. Confirm cleanup with `git gtr list`, `git branch --list '<head-branch>'`, and `git status --short --branch`.

Remote task branches are normally removed by GitHub's auto-delete setting. Delete a remaining remote branch only after verifying its PR is merged. Release PRs between long-lived branches require a release-specific decision and are outside this skill.
