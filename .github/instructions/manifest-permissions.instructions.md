---
description: Use when editing manifest files or introducing extension capabilities that may require new permissions. Covers least-privilege policy and browser compatibility checks.
applyTo: manifest*.json
---

# Manifest And Permission Rules

- Follow least privilege: add only permissions required by implemented features.
- When adding a permission, include a one-line rationale in the change summary.
- Keep page declarations in sync with actual page files under `src/pages`.
- For cross-browser features, verify background format expectations:
  - Chrome: `background.service_worker`
  - Firefox: `background.scripts`
- Avoid enabling optional capabilities until a feature depends on them.

# Validation Checklist

- Manifest keys and paths match existing files.
- New permissions are necessary and no broader than needed.
- Feature builds pass for intended target (`build:chrome`, `build:firefox`, or both).
