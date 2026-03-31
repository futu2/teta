# @teta/dev

Developer utilities for working with Teta query modules in Node and Bun.

This package depends on `@teta/teta` and uses Node APIs plus native clipboard support, so it is not intended for Deno.

## Install

### Bun

```bash
bunx jsr add @teta/dev
```

### Node.js

```bash
npx jsr add @teta/dev
```

## Render a source module

```ts
import { renderSqlFromSource } from "@teta/dev";

const sql = await renderSqlFromSource("./queries/users.ts");
console.log(sql);
```

## Watch and copy SQL

```ts
import { watchQuerySourceToClipboard } from "@teta/dev";

const watcher = await watchQuerySourceToClipboard({
  source: "./queries/users.ts",
  outputFile: "./tmp/users.sql",
});
```

## Copy SQL directly

```ts
import { copyTextToClipboard } from "@teta/dev";

await copyTextToClipboard("SELECT 1");
```
