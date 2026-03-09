import { spawnSync } from "node:child_process";

export type ClipboardTool =
  | "auto"
  | "xclip"
  | "xsel"
  | "wl-copy"
  | "pbcopy"
  | "clip";

type ClipboardCommand = {
  command: string;
  args: string[];
};

const CLIPBOARD_COMMANDS: Record<Exclude<ClipboardTool, "auto">, ClipboardCommand> = {
  "wl-copy": { command: "wl-copy", args: [] },
  xclip: { command: "xclip", args: ["-selection", "clipboard"] },
  xsel: { command: "xsel", args: ["--clipboard", "--input"] },
  pbcopy: { command: "pbcopy", args: [] },
  clip: { command: "clip", args: [] },
};

export function copyTextToClipboard(
  text: string,
  preferred: ClipboardTool = "auto"
): string {
  const candidates = resolveClipboardCandidates(preferred);
  for (const candidate of candidates) {
    const command = CLIPBOARD_COMMANDS[candidate];
    const result = spawnSync(command.command, command.args, {
      input: text,
      encoding: "utf8",
      stdio: ["pipe", "ignore", "pipe"],
    });
    if (result.status === 0 && !result.error) {
      return candidate;
    }
  }
  throw new Error(
    "Unable to copy SQL to clipboard. Install one of: wl-copy, xclip, xsel, pbcopy, or clip."
  );
}

function resolveClipboardCandidates(tool: ClipboardTool): Exclude<ClipboardTool, "auto">[] {
  if (tool !== "auto") return [tool];
  switch (process.platform) {
    case "darwin":
      return ["pbcopy", "wl-copy", "xclip", "xsel"];
    case "win32":
      return ["clip"];
    default:
      return ["wl-copy", "xclip", "xsel", "pbcopy", "clip"];
  }
}
