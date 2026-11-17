const MAX_IMAGE_EDGE = 1600;
const TARGET_FILE_BYTES = 1.4 * 1024 * 1024;
const STORAGE_FILE_BYTES = 5 * 1024 * 1024;
const JPEG_QUALITIES = [0.84, 0.76, 0.68, 0.68, 0.62, 0.62, 0.56, 0.56] as const;

function encodeJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('The browser could not encode this photo.'));
    }, 'image/jpeg', quality);
  });
}

function toJpegFile(blob: Blob, originalName: string): File {
  const baseName = originalName.replace(/\.[^.]+$/, '') || 'foundit-photo';
  return new File([blob], `${baseName}.jpg`, {
    type: 'image/jpeg',
    lastModified: Date.now(),
  });
}

/** Resize and compress a JPG/PNG in the browser before it reaches Supabase Storage. */
export async function compressImageForUpload(file: File): Promise<File> {
  if (!['image/jpeg', 'image/png'].includes(file.type)) {
    throw new Error('Only JPG and PNG photos can be compressed.');
  }
  if (file.size > STORAGE_FILE_BYTES) {
    throw new Error('Choose a JPG or PNG image up to 5 MB.');
  }

  const image = await createImageBitmap(file);
  try {
    const longestEdge = Math.max(image.width, image.height);
    if (file.size <= TARGET_FILE_BYTES && longestEdge <= MAX_IMAGE_EDGE) return file;

    const initialScale = Math.min(1, MAX_IMAGE_EDGE / longestEdge);
    const canvas = document.createElement('canvas');

    for (const [attempt, quality] of JPEG_QUALITIES.entries()) {
      const downscaleSteps = attempt < 2 ? 0 : Math.ceil((attempt - 1) / 2);
      const scale = initialScale * 0.86 ** downscaleSteps;
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));

      const context = canvas.getContext('2d', { alpha: false });
      if (!context) throw new Error('The browser could not prepare this photo.');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);

      const jpeg = await encodeJpeg(canvas, quality);
      if (jpeg.size <= TARGET_FILE_BYTES) return toJpegFile(jpeg, file.name);
      if (attempt === JPEG_QUALITIES.length - 1) {
        if (jpeg.size > STORAGE_FILE_BYTES) {
          throw new Error('The compressed photo is still too large to upload.');
        }
        return toJpegFile(jpeg, file.name);
      }
    }

    throw new Error('The browser could not prepare this photo.');
  } finally {
    image.close();
  }
}
