---
description: Use when implementing bookmark APIs, background event handlers, or message routing in src/pages/background. Covers source-of-truth logic, message contracts, and error handling.
applyTo: src/pages/background/**/*.ts
---

# Background Bookmark Rules

- Keep bookmark business logic centralized in this layer.
- Expose bookmark capabilities through explicit action handlers, not implicit side effects.
- Use typed request/response shapes for UI-to-background communication.
- Return predictable result envelopes for UI consumption:
  - success: `{ ok: true, data }`
  - error: `{ ok: false, error }`
- Normalize browser API failures into user-facing error messages and internal technical details.
- Avoid direct UI assumptions in background code.
- Add permission-sensitive operations only when corresponding manifest permissions are present.

# Implementation Checklist

- Action names are stable and descriptive.
- Input is validated before calling browser bookmark APIs.
- Errors are caught and mapped to a safe response object.
- Response payloads are backward-compatible for existing UI callers.
