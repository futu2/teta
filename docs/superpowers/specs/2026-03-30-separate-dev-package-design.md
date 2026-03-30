# Separate Dev Package Design

Date: 2026-03-30
Status: Approved for planning

## Summary

Split Teta's development helpers out of the core package into a separate published package in the same monorepo. The core package stays focused on the EDSL and SQL rendering surface. The new dev package owns source-file rendering, file watching, and clipboard integration.

Both packages will publish to JSR from the same GitHub repository.

## Decisions

- Use a monorepo with two packages:
  - `packages/teta`
  - `packages/dev`
- Remove dev helper exports from `@teta/teta` immediately in the next release.
- Publish both packages to JSR with independent versions.
- Keep `@teta/teta` focused on public EDSL, rendering, and error APIs.
- Make the dev package depend only on public exports from `@teta/teta`.
- Replace shelling out to `wl-copy`, `xclip`, `xsel`, `pbcopy`, and `clip` with `@mariozechner/clipboard`.

## Goals

- Keep the core package free of dev-tooling concerns and native clipboard dependencies.
- Preserve the existing dev-helper feature set in a separate package.
- Support JSR publishing for both packages from one repository.
- Avoid reaching into `@teta/teta` internals from the dev package.

## Non-Goals

- Adding compatibility re-exports from `@teta/teta`.
- Lockstep versioning between core and dev packages.
- Introducing additional internal shared packages unless later work proves they are needed.

## Package Layout

The repository becomes a workspace-style monorepo:

```text
/
  package.json
  bun.lock
  packages/
    teta/
      mod.ts
      jsr.json
      package.json
      src/
      tests/
      README.md
    dev/
      mod.ts
      jsr.json
      package.json
      src/
      tests/
      README.md
```

The root package coordinates shared install, shared lockfile, and workspace scripts. Each published package owns its own package metadata, docs, tests, and release config.

## Core Package Boundary

`packages/teta` remains the public EDSL package and exports:

- query builders
- expression helpers
- SQL rendering helpers like `toSql(...)` and `toSqlResult(...)`
- public render types such as `SqlOptions` and `SqlCompilable`
- public error classes and error types

`packages/teta` no longer exports:

- `copyTextToClipboard(...)`
- `renderSqlFromSource(...)`
- `watchQuerySourceToClipboard(...)`
- `ClipboardTool`
- `QueryLike`
- watch-specific controller and option types

Tests and docs in the core package must be updated to reflect that removal.

## Dev Package Boundary

`packages/dev` owns the current dev helper functionality:

- render SQL from a source module export
- watch source files and re-render SQL
- optionally write rendered SQL to disk
- copy rendered SQL to the system clipboard

This package depends on `@teta/teta` and should not import core-private source files. It may use Node APIs because the feature set is Node-oriented.

Recommended public surface:

```ts
export { copyTextToClipboard, renderSqlFromSource, watchQuerySourceToClipboard };
export type { ClipboardTool, QueryLike, WatchQueryController, WatchQuerySourceOptions };
```

Final package name is open, but the preferred shape is a scoped package under `@teta`, such as `@teta/dev`.

## Public API Seam Needed In Core

Today the dev helpers reach into `src/edsl/sql.ts` and `src/edsl/errors.ts` by relative path. After the split, the dev package must consume only public exports.

The new seam is:

- use `toSql(...)` from `@teta/teta` instead of importing internal renderer entrypoints
- use exported public types like `SqlOptions`, `SqlCompilable`, and `TetaUserError`
- instantiate `new TetaUserError(code, message)` in the dev package instead of relying on core-private helper functions

This keeps the dev package decoupled from core file layout and allows future core refactors without breaking the package boundary.

## Clipboard Integration

The existing implementation shells out to platform clipboard binaries. That behavior moves to the new dev package and is replaced by `@mariozechner/clipboard`.

Known package context at design time:

- npm package: `@mariozechner/clipboard`
- latest version seen: `0.3.2`
- description: fork of `@crosscopy/clipboard` with musl support

Design intent:

- keep clipboard support out of the core package
- let the dev package depend on the clipboard library directly
- adapt the dev helper API around the clipboard library rather than preserving the old OS-command implementation details

Implementation note:

- if `@mariozechner/clipboard` exposes async clipboard operations, the dev helper API should become async where needed instead of forcing a sync shell-process abstraction back into place

## Documentation Changes

Core docs must stop presenting dev helpers as part of `@teta/teta`:

- remove dev-helper imports and sections from `README.md`
- remove or relocate dev-helper material from `doc/cheatsheet.md`
- update tutorial references that imply dev helpers are part of the core package

The dev package gets its own docs:

- package README with install and import examples
- clipboard, watch, and source-rendering usage examples
- note that the package depends on `@teta/teta`

## Testing Strategy

Core package tests:

- remove tests that expect dev exports from the main entrypoint
- add or update tests to confirm the public entrypoint remains explicitly typed after the export removal

Dev package tests:

- move existing dev-helper tests under `packages/dev/tests`
- keep coverage for source rendering and watch option normalization
- add tests around the new clipboard adapter boundary
- avoid tests that depend on host clipboard binaries being present

## CI And Publishing

CI becomes workspace-aware:

- install once at the repo root
- run package-scoped tests and typechecks for both packages
- run JSR dry-run validation separately for `packages/teta` and `packages/dev`

Publishing changes:

- each package has its own `jsr.json`
- GitHub Actions publish jobs run with `working-directory` set to the package root
- both packages publish to JSR from the same repository
- versions are independent

This replaces the current single-package JSR workflow with package-specific dry-run and publish steps.

## Migration Notes

- the next core release is a breaking change because dev helpers are removed from `@teta/teta`
- consumers must switch imports from `@teta/teta` to the new dev package
- there is no transitional compatibility export in core

## Risks And Mitigations

### Risk: dev package still depends on core internals

Mitigation:

- rewrite imports to use only public `@teta/teta` exports before moving files

### Risk: clipboard package API differs from the current sync implementation

Mitigation:

- treat clipboard integration as an adapter layer with package-local tests
- allow async API adjustments in the dev package if required

### Risk: monorepo release flow breaks existing publishing

Mitigation:

- add package-specific JSR dry-run checks in CI before changing publish jobs
- keep package metadata isolated per package root

## Open Items For Planning

- final package name for the dev package under the `@teta` scope
- exact workspace script layout at repo root
- exact GitHub Actions triggers for package-specific publishes
- exact adapter API shape once `@mariozechner/clipboard` is wired in
