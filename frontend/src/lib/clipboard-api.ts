// Async Clipboard API helpers for the explicit "Paste" buttons (as opposed
// to the onPaste/Ctrl+V handlers, which use the synchronous
// ClipboardEvent.clipboardData and need no permission). Kept separate from
// clipboard-table-parse.ts so that module stays pure and dependency-free.

export class ClipboardPermissionError extends Error {}

async function readClipboardItems(): Promise<ClipboardItem[] | null> {
  if (!navigator.clipboard?.read) return null; // unsupported browser — caller falls back to Ctrl+V
  try {
    return await navigator.clipboard.read();
  } catch (err) {
    if (err instanceof DOMException && err.name === "NotAllowedError") {
      throw new ClipboardPermissionError();
    }
    return null;
  }
}

// Returns a File for the first image item found, or null if the clipboard
// has no image (or the browser doesn't support clipboard.read()). Throws
// ClipboardPermissionError if the browser blocks clipboard-read permission.
export async function readClipboardImageFile(): Promise<File | null> {
  const items = await readClipboardItems();
  if (!items) return null;
  for (const item of items) {
    const imageType = item.types.find((t) => t.startsWith("image/"));
    if (imageType) {
      const blob = await item.getType(imageType);
      const ext = imageType.split("/")[1] || "png";
      return new File([blob], `pasted-image.${ext}`, { type: imageType });
    }
  }
  return null;
}

// Returns clipboard text/html and text/plain (whichever are present), or
// null if neither is available. Same permission-error behavior as above.
export async function readClipboardTableSource(): Promise<{ html?: string; text?: string } | null> {
  const items = await readClipboardItems();
  if (!items) return null;
  for (const item of items) {
    const html = item.types.includes("text/html") ? await (await item.getType("text/html")).text() : undefined;
    const text = item.types.includes("text/plain") ? await (await item.getType("text/plain")).text() : undefined;
    if (html || text) return { html, text };
  }
  return null;
}
