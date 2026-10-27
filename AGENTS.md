# Testing Preferences
- Do not open a browser for manual or live testing.
- During development, prefer running ESLint only on changed files.
- Run the full ESLint check and full build at most once each, only for large changes, an explicit user request, or when needed to complete the task.
- Full builds may be skipped for documentation, copy, or simple styling changes.
- Limit verification to ESLint, bundling (build), and compilation success. Do not perform runtime or browser testing.

# Design Philosophy
- Prefer worse is better. Favour simple breakdowns that expose the implementation over excessive abstraction.
- Use simple text diagrams when helpful during planning or design discussions.
