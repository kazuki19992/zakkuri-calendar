---
name: add-screen
description: Use when adding a new Expo Router screen to zakkuri-calendar or substantially restructuring an existing screen and its navigation.
---

# Add a screen

1. Read the exact Expo SDK 57 Router documentation, the approved MVP design, and the relevant Issue or implementation plan.
2. Define observable screen behavior and add failing component, hook, or navigation tests before implementation.
3. Keep files within the agreed boundaries:
   - `src/app`: thin Expo Router route and composition files.
   - `src/features/<feature>/screens`: screen composition.
   - `src/features/<feature>/components`: feature-only presentation.
   - `src/features/<feature>/hooks`: interaction, loading, and orchestration logic.
   - `src/shared/components`: only UI reused by multiple screens, such as dialogs or toasts.
4. Screen and presentation components receive display-ready values and callbacks. They must not call SQLite, repositories, or device APIs directly. Custom hooks depend on domain repository contracts rather than SQLite implementations.
5. Reuse existing tokens and components before adding abstractions. Keep screen-specific UI in the feature until a real second consumer justifies moving it to shared.
6. Add accessible names/roles to interactive controls and cover loading, empty, error, and retry states that the Issue requires.
7. Run focused tests, then all available typecheck, lint, format-check, and test commands. Treat simulator/device layout and navigation as unverified until actually checked.
