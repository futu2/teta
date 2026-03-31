# Teta Monorepo

This repository publishes two JSR packages:

- `@teta/teta`: the core SQL EDSL, renderer, and public error/types surface
- `@teta/dev`: Node and Bun developer helpers for loading query modules, watching files, and clipboard workflows

Package guides:

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
