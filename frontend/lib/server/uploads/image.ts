import "server-only";
import sharp from "sharp";
import { createHash } from "node:crypto";
import { photoRules, uploadPolicy, UploadError } from "./policy.ts";

export type InspectedPhoto = { data: Buffer; mimeType: string; bytes: number; width: number; height: number; sha256: string };
export async function inspectPhoto(input: Buffer, declaredMime: string): Promise<InspectedPhoto> {
  if (input.length > photoRules.maxBytes) throw new UploadError("FILE_TOO_LARGE");
  if (!input.length) throw new UploadError("INVALID_IMAGE_FILE");
  const isPNG = input.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const isJPEG = input[0] === 255 && input[1] === 216 && input[2] === 255;
  const mimeType = isPNG ? "image/png" : isJPEG ? "image/jpeg" : undefined;
  if (!mimeType || mimeType !== declaredMime) throw new UploadError("UNSUPPORTED_IMAGE_TYPE");
  // APNG can otherwise be silently decoded as its first frame by a PNG loader.
  if (isPNG) {
    for (let offset = 8; offset + 12 <= input.length;) {
      const length = input.readUInt32BE(offset);
      if (input.toString("ascii", offset + 4, offset + 8) === "acTL") throw new UploadError("INVALID_IMAGE_FILE");
      if (length > input.length - offset - 12) throw new UploadError("INVALID_IMAGE_FILE");
      offset += length + 12;
    }
  }
  try {
    const options = { limitInputPixels: uploadPolicy.maxPixels, failOn: "warning" as const, sequentialRead: true };
    const metadata = await sharp(input, options).metadata();
    if (metadata.format !== (isPNG ? "png" : "jpeg") || (metadata.pages ?? 1) !== 1 || !metadata.width || !metadata.height
      || Math.max(metadata.width, metadata.height) > uploadPolicy.maxSide) throw new UploadError("INVALID_IMAGE_FILE");
    // No withMetadata/keepMetadata: re-encoding strips EXIF/GPS. Decode exactly this buffer, never re-read R2.
    const pipeline = sharp(input, options).rotate().toColourspace("srgb").timeout({ seconds: uploadPolicy.decodeSeconds });
    const { data, info } = await (isPNG ? pipeline.png({ compressionLevel: 9 }) : pipeline.jpeg({ quality: 90 }))
      .toBuffer({ resolveWithObject: true });
    if (info.width < photoRules.minWidth || info.height < photoRules.minHeight) throw new UploadError("IMAGE_DIMENSIONS_TOO_SMALL");
    if (data.length > photoRules.maxBytes) throw new UploadError("FILE_TOO_LARGE");
    return { data, mimeType, bytes: data.length, width: info.width, height: info.height,
      sha256: createHash("sha256").update(data).digest("hex") };
  } catch (error) {
    if (error instanceof UploadError) throw error;
    throw new UploadError("INVALID_IMAGE_FILE");
  }
}
