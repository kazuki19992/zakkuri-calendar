---
name: add-setting
description: Use when adding a persisted user-facing zakkuri-calendar setting, its default, validation, feature hook, or settings UI.
---

# Add a setting

1. Read the approved design and relevant Issue. Define the setting key, domain type, default, valid values, and behavior for missing or malformed stored data.
2. Add failing tests for default, valid persistence, malformed persistence, and UI behavior before implementation.
3. Persist settings through the SQLite `app_settings` model and typed settings repository. Do not introduce AsyncStorage or a second persistence path without an approved architecture change.
4. Keep parsing, validation, and defaults outside presentation components. Expose display-ready state and callbacks through a feature custom hook; do not call SQLite directly from UI.
5. Keep the repository contract independent of Expo/SQLite and its implementation in `src/data/sqlite`. Use bound parameters and avoid exposing malformed raw values in errors.
6. Add settings controls within the calendar feature until a genuinely reusable control has multiple screen consumers; only then move it to `src/shared/components`.
7. Verify focused repository, hook, and component tests, then all available typecheck, lint, format-check, and test commands. If native persistence is not exercised, report it as unverified.
