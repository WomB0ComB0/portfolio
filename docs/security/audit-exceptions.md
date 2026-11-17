# Dependency audit exceptions

## GHSA-fc5q-39xc-vjpf — picomatch

- **Approved:** November 17, 2026, by the repository owner.
- **Review by:** November 24, 2026. This date is a manual review deadline, not an automatic expiry.
- **Scope:** Only `bun run build` ignores this exact advisory. Every other high or critical advisory and audit execution failure still blocks the build.
- **Unaffected checks:** `bun audit`, `bun run audit`, `bun run audit:high`, and `bun run audit:moderate` continue to report the finding.

The [GitHub advisory](https://github.com/advisories/GHSA-fc5q-39xc-vjpf), reviewed and updated November 17, 2026, covers picomatch through 4.0.7 and lists no patched version. The npm registry also had no newer release when checked. It began blocking both GitHub and Vercel builds before application compilation without any dependency change in the consulting-link PR.

The reported risk is event-loop denial of service when attacker-controlled repeated extglob patterns reach the matcher. The direct glob imports found in this repository belong to development scripts. This observation is not a complete proof of non-reachability. The exception does not patch the dependency or assert that it is safe; it records the owner's decision to permit builds while keeping the finding visible in manual audits.

At the review date, check the advisory and upstream releases again. Once a patched release is available, update all affected locked copies, remove `--ignore GHSA-fc5q-39xc-vjpf` from the build command, and run the unfiltered audit, tests, and build. If no patch exists, explicitly reassess and document whether to retain the exception.
