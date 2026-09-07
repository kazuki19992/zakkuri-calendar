---
name: create-issue
description: Use when creating a GitHub Issue for zakkuri-calendar, including MVP tasks, bugs, improvements, documentation, or backlog items.
---

# Create a GitHub Issue

1. Search open and closed Issues using distinctive title keywords to avoid duplicates.
2. Read the relevant approved design or parent Issue and inspect current repository behavior when the acceptance criteria depend on code.
3. List current repository labels and choose only an existing appropriate label. Do not copy label names from another repository.
4. Write the title and body in Japanese unless the user requests otherwise. Use:

   ```markdown
   ## 概要

   <what will be delivered>

   ## 背景

   <why it is needed and current constraints>

   ## 受け入れ条件

   - [ ] <observable completion condition>

   ## 対象外

   - <explicitly deferred behavior>

   ## 関連

   <parent Issue, design, plan, or PR>
   ```

5. Keep acceptance criteria outcome-oriented and small enough for one reviewable PR. Separate independent work into child Issues when useful.
6. Create with `gh issue create`, then report the Issue number and URL. Never include API keys, local environment values, personal data, or private calendar content.
