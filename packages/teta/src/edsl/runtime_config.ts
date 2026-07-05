export function resolveFreezeFlag(name: string): boolean {
  const explicit = readEnv(name);
  if (explicit !== undefined) return explicit !== "0" && explicit !== "false";
  return true;
}

function readEnv(name: string): string | undefined {
  const env = globalThis as {
    process?: { env?: Record<string, string | undefined> };
  };

  try {
    return env.process?.env?.[name];
  } catch {
    return undefined;
  }
}
