"use client";

import * as React from "react";
import { ClipboardPaste, ImagePlus, Loader2, Repeat } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BlockActions } from "../block-actions";
import type { ImageBlock } from "../types";
import { ClipboardPermissionError, readClipboardImageFile } from "@/lib/clipboard-api";

// Resolves `block.imageUrl` into something an <img> can actually render.
// With no `resolveImageUrl` prop, `imageUrl` is used as-is (covers the
// standalone/no-backend case: a local blob: URL from handleFile below is
// already renderable). When a caller passes one (see executive-update-view.tsx),
// `imageUrl` is instead a backend-relative storage path that needs an
// authenticated fetch — same reason lib/api/documents.ts's downloads go
// through api.getBlob instead of a plain <a href>/<img src>.
export function useResolvedImageUrl(
  imageUrl: string,
  resolveImageUrl: ((imageUrl: string) => Promise<string>) | undefined
): { src: string; loading: boolean } {
  // Keyed by the imageUrl it was resolved for, so a stale resolution from a
  // previous image can't flash before the effect below catches up.
  const [resolved, setResolved] = React.useState<{ forUrl: string; src: string } | null>(null);

  React.useEffect(() => {
    if (!resolveImageUrl || !imageUrl) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    resolveImageUrl(imageUrl).then(
      (url) => {
        if (cancelled) return;
        objectUrl = url;
        setResolved({ forUrl: imageUrl, src: url });
      },
      () => {
        if (cancelled) return;
        setResolved({ forUrl: imageUrl, src: "" });
      }
    );
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [imageUrl, resolveImageUrl]);

  // No resolver at all — imageUrl (a local blob: URL) is already renderable,
  // nothing to resolve.
  if (!resolveImageUrl) return { src: imageUrl, loading: false };
  if (resolved?.forUrl === imageUrl) return { src: resolved.src, loading: false };
  return { src: "", loading: !!imageUrl };
}

export function ImageBlockEditor({
  block,
  onChange,
  onUpload,
  resolveImageUrl,
  ...actions
}: {
  block: ImageBlock;
  onChange: (patch: Partial<Pick<ImageBlock, "imageUrl" | "caption">>) => void;
  // Uploads a picked file and returns the value to store in `imageUrl`
  // (a backend storage path). Omit to fall back to a local blob: URL —
  // keeps this component usable with no backend at all.
  onUpload?: (file: File) => Promise<string>;
  resolveImageUrl?: (imageUrl: string) => Promise<string>;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
  const { src, loading: resolving } = useResolvedImageUrl(block.imageUrl, resolveImageUrl);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (!onUpload) {
      onChange({ imageUrl: URL.createObjectURL(file) });
      return;
    }
    setUploading(true);
    try {
      const imageUrl = await onUpload(file);
      onChange({ imageUrl });
    } finally {
      setUploading(false);
    }
  };

  // Covers both OS screenshots/"Copy Image" (arrive via .items with
  // kind: "file", often before .files is populated) and copied image files
  // (arrive via .files).
  const extractImageFile = (clipboardData: DataTransfer): File | null => {
    for (let i = 0; i < clipboardData.items.length; i++) {
      const item = clipboardData.items[i];
      if (item.kind === "file" && item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) return file;
      }
    }
    for (let i = 0; i < clipboardData.files.length; i++) {
      if (clipboardData.files[i].type.startsWith("image/")) return clipboardData.files[i];
    }
    return null;
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    if (!e.clipboardData) return;
    const file = extractImageFile(e.clipboardData);
    if (!file) return; // no image on clipboard — silent no-op
    e.preventDefault();
    void handleFile(file);
  };

  const handlePasteClick = async () => {
    try {
      const file = await readClipboardImageFile();
      if (!file) {
        toast.info("No image found on clipboard.");
        return;
      }
      await handleFile(file);
    } catch (err) {
      if (err instanceof ClipboardPermissionError) {
        toast.error("Clipboard access was blocked — press Ctrl+V instead.");
      } else {
        console.error("Paste Image failed:", err);
        toast.error("Couldn't read the clipboard — try Ctrl+V instead.");
      }
    }
  };

  const busy = uploading || resolving;

  return (
    <div
      tabIndex={0}
      onPaste={handlePaste}
      className="rounded-lg border border-slate-200 bg-white outline-none focus-visible:ring-2 focus-visible:ring-[#1a6fc4]"
    >
      <div className="flex items-center justify-end border-b border-slate-100 bg-slate-50 px-1.5 py-1">
        <BlockActions {...actions} />
      </div>

      <div className="p-4">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => handleFile(e.target.files?.[0])}
        />

        {block.imageUrl ? (
          <div className="flex flex-col gap-3">
            {busy ? (
              <div className="flex h-40 w-full items-center justify-center rounded-lg border border-slate-200 bg-slate-50">
                <Loader2 className="size-5 animate-spin text-slate-400" />
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- src is either a local blob: URL or a resolved fetch, not an optimizable remote image.
              <img
                src={src}
                alt={block.caption || "Uploaded image"}
                className="max-h-80 w-full rounded-lg border border-slate-200 object-contain"
              />
            )}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => inputRef.current?.click()}
              >
                <Repeat className="size-3.5" />
                Replace
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => onChange({ imageUrl: "" })}
              >
                Delete
              </Button>
              <Button type="button" variant="default" size="sm" disabled={busy} onClick={handlePasteClick}>
                <ClipboardPaste className="size-3.5" />
                Paste
              </Button>
            </div>
            <Input
              placeholder="Caption (optional)"
              value={block.caption}
              onChange={(e) => onChange({ caption: e.target.value })}
            />
          </div>
        ) : (
          <div className="flex w-full flex-col items-center gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center">
            {busy ? (
              <Loader2 className="size-6 animate-spin text-slate-400" />
            ) : (
              <ImagePlus className="size-6 text-slate-400" />
            )}
            <span className="text-sm font-semibold text-slate-600">
              {busy ? "Uploading…" : "Upload an image or paste one from your clipboard"}
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => inputRef.current?.click()}
              >
                Upload
              </Button>
              <Button type="button" variant="default" size="sm" disabled={busy} onClick={handlePasteClick}>
                <ClipboardPaste className="size-3.5" />
                Paste Image
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
