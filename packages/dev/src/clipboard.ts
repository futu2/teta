import { TetaUserError } from "@teta/teta";
import { writeClipboardText } from "./clipboard_client.ts";

export type ClipboardTool = "auto" | "native";

export async function copyTextToClipboard(
  text: string,
  preferred: ClipboardTool = "auto"
): Promise<ClipboardTool> {
  return copyTextToClipboardWithWriter(text, preferred, writeClipboardText);
}

export async function copyTextToClipboardWithWriter(
  text: string,
  preferred: ClipboardTool,
  writeClipboard: (text: string) => Promise<void>
): Promise<ClipboardTool> {
  if (preferred !== "auto" && preferred !== "native") {
    throw new TetaUserError(
      "CLIPBOARD_TOOL_UNAVAILABLE",
      `Unsupported clipboard backend '${preferred}'`
    );
  }

  try {
    await writeClipboard(text);
    return "native";
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new TetaUserError(
      "CLIPBOARD_TOOL_UNAVAILABLE",
      `Unable to copy SQL to clipboard: ${message}`
    );
  }
}
