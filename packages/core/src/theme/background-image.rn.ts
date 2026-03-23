/**
 * Background image processing for React Native.
 *
 * Uses expo-image-manipulator for resize/compress instead of Canvas API.
 * Mirrors the constraints of background-image.ts (max 1920px, max 500KB).
 */

/** Maximum long-edge dimension */
const MAX_DIMENSION = 1920;
/** Maximum compressed size in bytes (500KB) */
const MAX_SIZE_BYTES = 500 * 1024;

/**
 * Process an image URI into a compressed data URI suitable for theme storage.
 * Resizes to max 1920px on the longest edge and compresses.
 *
 * @param uri - Local file URI (from expo-image-picker)
 * @returns data URI string, or throws if too large after compression
 */
export async function processBackgroundImageRN(uri: string): Promise<string> {
  const ImageManipulator = await import("expo-image-manipulator");

  // First pass: resize and compress as JPEG
  let quality = 0.85;
  const minQuality = 0.4;

  while (quality >= minQuality) {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: MAX_DIMENSION } }],
      {
        compress: quality,
        format: ImageManipulator.SaveFormat.WEBP,
        base64: true,
      },
    );

    if (result.base64) {
      const size = Math.floor((result.base64.length * 3) / 4);
      if (size <= MAX_SIZE_BYTES) {
        return `data:image/webp;base64,${result.base64}`;
      }
    }

    quality -= 0.1;
  }

  // Final attempt at minimum quality
  const finalResult = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: MAX_DIMENSION } }],
    {
      compress: minQuality,
      format: ImageManipulator.SaveFormat.WEBP,
      base64: true,
    },
  );

  if (finalResult.base64) {
    const size = Math.floor((finalResult.base64.length * 3) / 4);
    if (size <= MAX_SIZE_BYTES) {
      return `data:image/webp;base64,${finalResult.base64}`;
    }
  }

  throw new Error("IMAGE_TOO_LARGE");
}
