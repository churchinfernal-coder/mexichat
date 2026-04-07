/**
 * Client-side image compression before uploading to Supabase Storage.
 * Reduces bandwidth, storage costs, and upload time.
 */

interface CompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;     // 0-1
  maxSizeMB?: number;   // target max file size
  outputType?: string;  // default: image/webp
}

const DEFAULTS: Required<CompressOptions> = {
  maxWidth: 1920,
  maxHeight: 1920,
  quality: 0.82,
  maxSizeMB: 1,
  outputType: 'image/webp',
};

export async function compressImage(file: File, opts?: CompressOptions): Promise<File> {
  // Skip non-images and GIFs (animated)
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;

  const o = { ...DEFAULTS, ...opts };

  // Skip if already small enough
  if (file.size <= o.maxSizeMB * 1024 * 1024) return file;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      // Calculate new dimensions
      let { width, height } = img;
      if (width > o.maxWidth || height > o.maxHeight) {
        const ratio = Math.min(o.maxWidth / width, o.maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      // Draw on canvas
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(file); return; }
      ctx.drawImage(img, 0, 0, width, height);

      // Convert to blob
      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return; }

          // If compressed is larger than original, return original
          if (blob.size >= file.size) { resolve(file); return; }

          const ext = o.outputType === 'image/webp' ? 'webp' : 'jpg';
          const name = file.name.replace(/\.[^.]+$/, `.${ext}`);
          const compressed = new File([blob], name, { type: o.outputType, lastModified: Date.now() });

          console.log(`[Compress] ${(file.size/1024).toFixed(0)}KB -> ${(compressed.size/1024).toFixed(0)}KB (${Math.round(100 - (compressed.size/file.size)*100)}% saved)`);
          resolve(compressed);
        },
        o.outputType,
        o.quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file); // fallback: return original
    };

    img.src = url;
  });
}

// Compress multiple files
export async function compressImages(files: File[], opts?: CompressOptions): Promise<File[]> {
  return Promise.all(files.map(f => compressImage(f, opts)));
}

// Generate thumbnail (small preview)
export async function generateThumbnail(file: File, size = 200): Promise<File> {
  return compressImage(file, {
    maxWidth: size,
    maxHeight: size,
    quality: 0.7,
    maxSizeMB: 0.05,
    outputType: 'image/webp',
  });
}

/**
 * Crop image to square (center crop) for avatars.
 * Enterprise-grade: validates input, handles edge cases.
 */
export async function cropToSquare(file: File, size = 512): Promise<File> {
  if (!file || !file.type.startsWith('image/')) {
    throw new Error('Invalid file: must be an image');
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(file); return; }

        const min = Math.min(img.width, img.height);
        const sx = (img.width - min) / 2;
        const sy = (img.height - min) / 2;

        ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);

        canvas.toBlob(
          (blob) => {
            if (!blob) { resolve(file); return; }
            const cropped = new File([blob], file.name, {
              type: 'image/webp',
              lastModified: Date.now(),
            });
            resolve(cropped);
          },
          'image/webp',
          0.9
        );
      } catch {
        resolve(file);
      } finally {
        URL.revokeObjectURL(url);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image for cropping'));
    };

    img.src = url;
  });
}
