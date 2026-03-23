/**
 * Background image processing — resize, compress to WebP data URI.
 *
 * Desktop: uses canvas + toBlob("image/webp")
 * Mobile: expected to use expo-image-manipulator (handled separately)
 *
 * Constraints:
 *   - Max dimension: 1920px (long edge)
 *   - Max compressed size: 500KB
 *   - Output format: WebP data URI (base64)
 */

/** Maximum long-edge dimension */
const MAX_DIMENSION = 1920;
/** Maximum compressed size in bytes (500KB) */
const MAX_SIZE_BYTES = 500 * 1024;

/**
 * Process a File into a compressed WebP data URI suitable for theme storage.
 * Resizes to max 1920px on the longest edge and compresses as WebP.
 *
 * @returns data URI string, or throws if too large after compression
 */
export async function processBackgroundImage(file: File): Promise<string> {
  // Load image
  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;

  // Compute resize dimensions
  let targetW = width;
  let targetH = height;
  const longestEdge = Math.max(width, height);
  if (longestEdge > MAX_DIMENSION) {
    const scale = MAX_DIMENSION / longestEdge;
    targetW = Math.round(width * scale);
    targetH = Math.round(height * scale);
  }

  // Draw to canvas
  const canvas = new OffscreenCanvas(targetW, targetH);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Cannot create canvas context");
  ctx.drawImage(bitmap, 0, 0, targetW, targetH);
  bitmap.close();

  // Compress to WebP with quality stepping
  let blob: Blob;
  let quality = 0.85;
  const minQuality = 0.4;

  while (quality >= minQuality) {
    blob = await canvas.convertToBlob({ type: "image/webp", quality });
    if (blob.size <= MAX_SIZE_BYTES) {
      return blobToDataURI(blob);
    }
    quality -= 0.1;
  }

  // Final attempt at minimum quality
  blob = await canvas.convertToBlob({ type: "image/webp", quality: minQuality });
  if (blob.size <= MAX_SIZE_BYTES) {
    return blobToDataURI(blob);
  }

  throw new Error("IMAGE_TOO_LARGE");
}

/** Convert Blob to data URI */
async function blobToDataURI(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `data:${blob.type};base64,${btoa(binary)}`;
}

/**
 * Get the size of a data URI in bytes (approximate).
 */
export function getDataURISize(dataURI: string): number {
  // data:image/webp;base64,XXXXX
  const commaIdx = dataURI.indexOf(",");
  if (commaIdx === -1) return 0;
  const base64 = dataURI.slice(commaIdx + 1);
  // Base64 encodes 3 bytes into 4 chars
  return Math.floor((base64.length * 3) / 4);
}
