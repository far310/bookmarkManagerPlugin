---
description: Use when building bookmark UI flows in popup/options/newtab pages. Covers thin-view architecture, state handling, and user feedback conventions.
applyTo: src/pages/{popup,options,newtab}/**/*.{ts,tsx,css}
---

# Bookmark UI Rules

- Keep views thin: call background actions for business logic instead of re-implementing logic in UI.
- Every bookmark action must have visible loading, success, and error states.
- Prefer optimistic UI only when rollback behavior is defined.
- Keep components focused and composable; avoid monolithic page components.
- Use Tailwind utility classes first; keep custom CSS minimal and page-scoped.
- Preserve accessibility basics for interactive controls (labels, keyboard reachability, focus visibility).

# UX Consistency

- Use consistent action labels for bookmark operations across pages.
- Show actionable error text, not raw exception dumps.
- Keep empty states explicit, with clear next action guidance.
