---
name: pr-review
description: Use when reviewing a zakkuri-calendar pull request or when fetching, addressing, replying to, and resolving review threads on an existing PR.
---

# Pull request review

## Review a PR

1. Read the PR metadata, linked Issue/design/plan, and complete diff. Inspect full changed files where local context matters.
2. Check correctness and edge cases first, then architecture boundaries, tests, migrations, accessibility, security/privacy, and documentation.
3. Distinguish actionable defects from optional suggestions. Anchor inline comments to changed lines and explain the concrete failure mode and smallest sound correction.
4. Post one coherent review. Approve or request changes only when the user explicitly asks for that review state.

## Address review threads

1. Fetch current review threads through GitHub GraphQL, including `id`, `isResolved`, `isOutdated`, path, line, and comments. Compare comments with the current head before editing.
2. Validate each suggestion technically. Do not implement a comment merely to agree with it; explain and seek direction when it conflicts with approved design or safety.
3. For valid comments, add or update a failing test when behavior changes, make the smallest correction, and run focused plus repository-wide verification.
4. Commit and push the correction, reply to each addressed thread with evidence, then resolve only threads whose issue is actually fixed.
5. Fetch threads again and report unresolved items, current head, checks run, and any simulator/device behavior that remains unverified.

Never expose secrets or private calendar data in review output. Do not claim GitHub checks, device behavior, or merge state without current evidence.
