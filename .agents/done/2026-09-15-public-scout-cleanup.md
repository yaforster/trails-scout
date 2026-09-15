# Public Scout Cleanup

## Scope

Prepare `trails-scout` for public publishing without shipping local endpoints, IDE state, generated output, or credentials. Keep private local runtime instructions and configuration in sibling private repositories.

## Decisions

- Public popup defaults for the Keycloak token endpoint, Trails service URL, and client ID are blank. Existing browser-local storage restoration remains unchanged.
- A clean clone uses `npm ci` once, then `npm start` for watch builds or `npm run build` for a stable extension build.
- Loading an unpacked browser extension and the Keycloak login/CORS check are manual steps.
- No credentials, client secrets, Keycloak realm imports, or local service URLs belong in the public Scout repository.

## Changes

1. Add `npm start`, declare the lockfile-compatible Node range, remove the broken local-host script, and mirror the package metadata in the lockfile.
2. Blank the three shipped popup connection values and cover them with a raw-HTML Vitest regression test.
3. Rewrite the public README for installation, builds, unpacked loading, generic connection settings, and browser-local storage.
4. Delete and ignore IDE, OS, and generated Scout artifacts.
5. Make `trails-dev-local` Compose own a single internal JWK decoder source; remove conflicting decoder settings from its environment template and shared edge helpers.
6. Document private Keycloak client, realm-role, extension-origin, and manual browser smoke-check setup in `trails-dev-local`.
7. Record the verified cross-repository ownership boundary in workspace continuity.

## Invariants

- Public Scout has no local endpoint or client-ID default and no runtime dependency on private repositories.
- Stored extension settings still override blank HTML defaults.
- OAuth-enabled local Trails Service has exactly one decoder source and all required role mappings.
- Private docs may use local endpoints but never include credentials or secrets.

## Verification

- `npm.cmd ci`
- `npm.cmd test`
- `npm.cmd run format:check`
- `npm.cmd run build`
- `npm.cmd start` until Vite reports ready, then stop
- Inspect generated `dist/manifest.json`, Compose interpolation, final diffs/status, and artifact scans.
- Manual: load `dist` unpacked, configure its exact Keycloak Web Origin, log in, load applications, and confirm no Keycloak/service CORS or authorization error.

## Approval

Plan review: `PROCEED`. Architecture and simplicity reviews had no findings. The adversarial review required the explicit manual extension auth/CORS smoke check, which was added and re-reviewed with no findings.

## Outcome

- Public Scout cleanup removed shipped local connection defaults, IDE/OS/generated artifacts, and added `npm start`/`npm run build` with generic public documentation. `trails-dev-local` owns local Scout/Keycloak setup and Compose's exactly-one-JWK decoder configuration; shared edge helpers no longer add conflicting decoder sources.
- Verification passed: clean `npm.cmd ci`; `npm.cmd test` (16 files/104 tests); `npm.cmd run format:check`; `npm.cmd run build`; Vite reached ready; Compose config passed, including ambient-decoder invariant.
- Manual unpacked-extension Keycloak CORS/auth smoke was not performed. It remains documented user-run work requiring local credentials and client configuration.
- Specialist feedback recorded: plan-stage architecture and simplicity reviews had no findings; adversarial review required manual extension auth/CORS smoke, then re-review had no findings. Implementation-stage security and simplicity reviews had no findings; architecture found ambient issuer injection could create two decoder sources, which was fixed and re-reviewed clear. Code review: `APPROVE`.
- Documentation updated: public Scout README covers generic installation/build/connection guidance; private `trails-dev-local` README covers local Scout/Keycloak setup and manual smoke; workspace `../CONTINUITY.md` records outcome and verification.
