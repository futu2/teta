export async function writeClipboardText(text: string): Promise<void> {
  const Clipboard = await import("@mariozechner/clipboard");
  await Clipboard.setText(text);
}
