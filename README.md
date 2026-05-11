# Teta Monorepo

This repository publishes three JSR packages:

- `@teta/sql`: reusable SQL IR, dialects, and rendering backend
- `@teta/teta`: the TypeScript SQL EDSL frontend with direct `toSql(...)` helpers
- `@teta/dev`: Node and Bun developer helpers for loading query modules, watching files, and clipboard workflows

Package guides:

- [SQL backend package README](packages/sql/README.md)
- [Core package README](packages/teta/README.md)
- [Dev package README](packages/dev/README.md)

Common repo commands:

```bash
bun install
bun run check
bun run test:runtime:bun
bun run test:runtime:node
bun run test:runtime:deno
```
