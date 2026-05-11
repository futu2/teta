# @teta/dev

Developer utilities for working with Teta query modules in Node and Bun.

This package depends on `@teta/teta` for the frontend `toSql(...)` convenience path. It does not depend on the backend package directly. It uses Node APIs plus native clipboard support, so it is not intended for Deno.

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

`renderSqlFromSource(...)` looks for an export named `query` by default. Pass a custom `exportName` if your source module uses a different name.

## Watch and copy SQL

```ts
import { watchQuerySourceToClipboard } from "@teta/dev";

const watcher = await watchQuerySourceToClipboard({
  source: "./queries/users.ts",
  outputFile: "./tmp/users.sql",
});
```

Watch mode copies SQL to the clipboard by default and uses isolated module loading by default. Set `copyToClipboard: false` if you only want file output or logging.

## Copy SQL directly

```ts
import { copyTextToClipboard } from "@teta/dev";

await copyTextToClipboard("SELECT 1");
```
