# Dependency audit exceptions

No exception is active. `bun run build` runs the unfiltered `bun audit --audit-level=high`, so every
high or critical advisory and every audit execution failure blocks the build again.

To add an exception, record the advisory, the owner's approval, the exact scope of the `--ignore`
flag, a review date and the reasoning here, in the same change that adds the flag.

## Retired exceptions

### GHSA-fc5q-39xc-vjpf — picomatch

- **Approved:** November 17, 2026, by the repository owner.
- **Retired:** November 19, 2026, ahead of the November 24 review date.
- **Scope while active:** Only `bun run build` ignored this exact advisory. `bun audit`,
  `bun run audit`, `bun run audit:high` and `bun run audit:moderate` kept reporting it.

The [GitHub advisory](https://github.com/advisories/GHSA-fc5q-39xc-vjpf) covered picomatch through
4.0.7 and listed no patched version. It began blocking both GitHub and Vercel builds before
application compilation without any dependency change in the consulting-link PR, so the owner
approved a build-only exception while keeping the finding visible in manual audits.

GitHub withdrew the advisory on November 18, 2026 (its summary now begins "Withdrawn Advisory"). On
November 19, an unfiltered `bun audit` of the lockfile reported "No vulnerabilities found (checked
1648 packages)", so `--ignore GHSA-fc5q-39xc-vjpf` was removed from the build command.
