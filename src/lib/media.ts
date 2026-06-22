import imageCompression from "browser-image-compression";

export interface UploadedMedia {
  mediaId: string;
  publicUrl: string | null;
}

/**
 * Compress an image in the browser, upload it directly to storage via a
 * presigned URL, then record the media row. Returns the new media id so the
 * caller can attach it (e.g. as a person's avatar).
 */
export async function uploadImage(
  treeId: string,
  file: File,
  options: {
    personId?: string;
    caption?: string;
    category?: "avatar" | "photo";
  } = {},
): Promise<UploadedMedia> {
  const compressed = await imageCompression(file, {
    maxSizeMB: 0.6,
    maxWidthOrHeight: 1024,
    useWebWorker: true,
  });
  const contentType = compressed.type || "image/jpeg";

  // 1. Ask the server for a presigned upload URL.
  const presignRes = await fetch("/api/media/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      treeId,
      contentType,
      fileName: file.name,
      personId: options.personId,
      category: options.category ?? "photo",
    }),
  });
  if (!presignRes.ok) throw new Error("Could not start upload");
  const { uploadUrl, key } = await presignRes.json();

  // 2. PUT the bytes straight to storage.
  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: compressed,
  });
  if (!putRes.ok) throw new Error("Upload failed");

  // 3. Record the media row.
  const recordRes = await fetch("/api/media", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      treeId,
      storageKey: key,
      mimeType: contentType,
      personId: options.personId,
      caption: options.caption,
    }),
  });
  if (!recordRes.ok) throw new Error("Could not save media");
  const media = await recordRes.json();
  return { mediaId: media.id, publicUrl: media.url ?? media.publicUrl ?? null };
}
