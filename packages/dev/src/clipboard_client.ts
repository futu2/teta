import * as Clipboard from "@mariozechner/clipboard";

export async function writeClipboardText(text: string): Promise<void> {
  await Clipboard.setText(text);
}
