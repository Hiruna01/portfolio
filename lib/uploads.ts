import "server-only";
import { randomBytes } from "node:crypto";

const MAX_BYTES = 4 * 1024 * 1024;

/** Works out the image type from the file's first bytes. The browser-supplied type and file name are not trusted. */
function sniff(bytes: Uint8Array): { ext: string; mime: string } | null {
  const starts = (...sig: number[]) => sig.every((b, i) => bytes[i] === b);
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return { ext: "png", mime: "image/png" };
  if (starts(0xff, 0xd8, 0xff)) return { ext: "jpg", mime: "image/jpeg" };
  const riff = starts(0x52, 0x49, 0x46, 0x46);
  const webp = [0x57, 0x45, 0x42, 0x50].every((b, i) => bytes[8 + i] === b);
  if (riff && webp) return { ext: "webp", mime: "image/webp" };
  // "GIF87a" or "GIF89a". Animated GIFs are allowed, mainly for project card previews.
  if (starts(0x47, 0x49, 0x46, 0x38) && (bytes[4] === 0x37 || bytes[4] === 0x39) && bytes[5] === 0x61) return { ext: "gif", mime: "image/gif" };
  return null;
}

export class UploadError extends Error {}

/**
 * Saves an uploaded image and returns the address to use for it.
 * On Vercel it goes to Blob storage (needs BLOB_READ_WRITE_TOKEN). In local development it goes to public/uploads/.
 */
export async function storeImage(file: File): Promise<string> {
  if (file.size > MAX_BYTES) throw new UploadError("That image is over 4 MB. Choose a smaller one.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniff(bytes);
  if (!type) throw new UploadError("That file is not a PNG, JPEG, WebP or GIF image.");

  // The stored name is random, so nothing from the original file name reaches the file system or a URL.
  const name = `${randomBytes(12).toString("hex")}.${type.ext}`;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import("@vercel/blob");
    const blob = await put(`uploads/${name}`, Buffer.from(bytes), { access: "public", contentType: type.mime });
    return blob.url;
  }
  if (process.env.VERCEL) {
    throw new UploadError("Uploads are not set up yet. Add Blob storage to the project, or paste an image address instead.");
  }
  const { mkdir, writeFile } = await import("node:fs/promises");
  await mkdir("public/uploads", { recursive: true });
  await writeFile(`public/uploads/${name}`, bytes);
  return `/uploads/${name}`;
}
