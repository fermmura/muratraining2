/** Os mesmos números do 1.0 (app.js:2013-2016). */
export const PHOTO_MAX_SIDE = 700;
export const PHOTO_QUALITY = 0.6;
/** Acima disso o documento da foto chegaria perto do teto de 1MB do Firestore. */
export const PHOTO_MAX_CHARS = 700_000;

/**
 * Reduz a foto no aparelho e devolve um data URL JPEG. `createImageBitmap`
 * respeita a orientação EXIF, então foto de celular não chega deitada.
 */
export async function compressImage(
  file: File,
  maxSide = PHOTO_MAX_SIDE,
  quality = PHOTO_QUALITY,
): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", quality);
}
