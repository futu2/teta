export function resolveFreezeFlag(name: string): boolean {
  const env = globalThis as {
    process?: { env?: Record<string, string | undefined> };
  };
  const explicit = env.process?.env?.[name];
  if (explicit !== undefined) return explicit !== "0" && explicit !== "false";

  const nodeEnv = env.process?.env?.NODE_ENV;
  return nodeEnv !== "production";
}
