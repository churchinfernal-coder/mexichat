/**
 * MexiChat - Native Media Service
 * Bridges Capacitor Camera/Filesystem APIs with web fallback.
 * On native (Android/iOS): uses device camera or photo gallery directly.
 * On web: falls back to HTML file input (existing behavior).
 *
 * Usage:
 *   import { pickImage, takePhoto, pickFile } from '@/services/nativeMedia';
 *   const file = await pickImage();
 *   const file = await takePhoto();
 *   const file = await pickFile('image/*');
 */

import { Capacitor } from '@capacitor/core';

let CameraModule: typeof import('@capacitor/camera') | null = null;
let FilesystemModule: typeof import('@capacitor/filesystem') | null = null;

async function loadNativeModules() {
  if (!CameraModule) CameraModule = await import('@capacitor/camera');
  if (!FilesystemModule) FilesystemModule = await import('@capacitor/filesystem');
}

export interface MediaResult {
  file: File;
  previewUrl: string;
  width?: number;
  height?: number;
  source: 'camera' | 'gallery' | 'file-input';
}

export interface PickOptions {
  quality?: number;
  maxWidth?: number;
  maxHeight?: number;
  allowEditing?: boolean;
}

function base64ToFile(base64: string, fileName: string, mimeType: string): File {
  const byteString = atob(base64);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
  return new File([ab], fileName, { type: mimeType, lastModified: Date.now() });
}

function getMimeFromFormat(format: string): string {
  const map: Record<string, string> = { jpeg: 'image/jpeg', jpg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp' };
  return map[format.toLowerCase()] || 'image/jpeg';
}

async function webFilePicker(accept: string, multiple = false): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = multiple;
    input.style.display = 'none';
    document.body.appendChild(input);
    input.addEventListener('change', () => { const files = input.files ? Array.from(input.files) : []; document.body.removeChild(input); resolve(files); });
    input.addEventListener('cancel', () => { document.body.removeChild(input); resolve([]); });
    input.click();
  });
}

export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

export async function checkCameraPermission(): Promise<boolean> {
  if (!isNativePlatform()) return true;
  try {
    await loadNativeModules();
    const { Camera } = CameraModule!;
    const status = await Camera.checkPermissions();
    if (status.camera === 'granted' && status.photos === 'granted') return true;
    const requested = await Camera.requestPermissions();
    return requested.camera === 'granted';
  } catch (err) {
    console.warn('[nativeMedia] Permission check failed:', err);
    return false;
  }
}

export async function takePhoto(opts?: PickOptions): Promise<MediaResult | null> {
  const quality = opts?.quality ?? 90;
  const maxW = opts?.maxWidth ?? 1920;
  const maxH = opts?.maxHeight ?? 1920;
  const allowEditing = opts?.allowEditing ?? false;

  if (isNativePlatform()) {
    try {
      await loadNativeModules();
      const { Camera, CameraResultType, CameraSource } = CameraModule!;
      const photo = await Camera.getPhoto({
        quality, width: maxW, height: maxH, allowEditing,
        resultType: CameraResultType.Base64,
        source: CameraSource.Camera,
        correctOrientation: true, saveToGallery: false,
      });
      if (!photo.base64String) return null;
      const format = photo.format || 'jpeg';
      const mime = getMimeFromFormat(format);
      const fileName = `photo_${Date.now()}.${format}`;
      const file = base64ToFile(photo.base64String, fileName, mime);
      const previewUrl = `data:${mime};base64,${photo.base64String}`;
      console.log(`[nativeMedia] Camera photo: ${(file.size / 1024).toFixed(0)}KB`);
      return { file, previewUrl, source: 'camera' };
    } catch (err: any) {
      if (err?.message?.includes('User cancelled')) return null;
      console.error('[nativeMedia] Camera error:', err);
    }
  }
  const files = await webFilePicker('image/*');
  if (!files.length) return null;
  const file = files[0];
  return { file, previewUrl: URL.createObjectURL(file), source: 'file-input' };
}

export async function pickImage(opts?: PickOptions): Promise<MediaResult | null> {
  const quality = opts?.quality ?? 90;
  const maxW = opts?.maxWidth ?? 1920;
  const maxH = opts?.maxHeight ?? 1920;
  const allowEditing = opts?.allowEditing ?? false;

  if (isNativePlatform()) {
    try {
      await loadNativeModules();
      const { Camera, CameraResultType, CameraSource } = CameraModule!;
      const photo = await Camera.getPhoto({
        quality, width: maxW, height: maxH, allowEditing,
        resultType: CameraResultType.Base64,
        source: CameraSource.Photos,
        correctOrientation: true,
      });
      if (!photo.base64String) return null;
      const format = photo.format || 'jpeg';
      const mime = getMimeFromFormat(format);
      const fileName = `gallery_${Date.now()}.${format}`;
      const file = base64ToFile(photo.base64String, fileName, mime);
      const previewUrl = `data:${mime};base64,${photo.base64String}`;
      console.log(`[nativeMedia] Gallery pick: ${(file.size / 1024).toFixed(0)}KB`);
      return { file, previewUrl, source: 'gallery' };
    } catch (err: any) {
      if (err?.message?.includes('User cancelled')) return null;
      console.error('[nativeMedia] Gallery error:', err);
    }
  }
  const files = await webFilePicker('image/*');
  if (!files.length) return null;
  const file = files[0];
  return { file, previewUrl: URL.createObjectURL(file), source: 'file-input' };
}

export async function pickMultipleImages(opts?: PickOptions): Promise<MediaResult[]> {
  if (isNativePlatform()) {
    try {
      await loadNativeModules();
      const { Camera } = CameraModule!;
      const result = await Camera.pickImages({
        quality: opts?.quality ?? 90,
        width: opts?.maxWidth ?? 1920,
        height: opts?.maxHeight ?? 1920,
        limit: 10,
      });
      const results: MediaResult[] = [];
      for (const photo of result.photos) {
        if (!photo.webPath) continue;
        try {
          const response = await fetch(photo.webPath);
          const blob = await response.blob();
          const format = photo.format || 'jpeg';
          const mime = getMimeFromFormat(format);
          const fileName = `gallery_${Date.now()}_${results.length}.${format}`;
          const file = new File([blob], fileName, { type: mime, lastModified: Date.now() });
          results.push({ file, previewUrl: photo.webPath, source: 'gallery' });
        } catch (err) { console.warn('[nativeMedia] Failed to process picked image:', err); }
      }
      console.log(`[nativeMedia] Picked ${results.length} images`);
      return results;
    } catch (err: any) {
      if (err?.message?.includes('User cancelled')) return [];
      console.error('[nativeMedia] Multi-pick error:', err);
    }
  }
  const files = await webFilePicker('image/*', true);
  return files.map((file) => ({ file, previewUrl: URL.createObjectURL(file), source: 'file-input' as const }));
}

export async function pickFile(
  accept = 'image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm',
  multiple = false
): Promise<File[]> {
  return webFilePicker(accept, multiple);
}

export async function pickOrTakePhoto(opts?: PickOptions): Promise<MediaResult | null> {
  if (!isNativePlatform()) return pickImage(opts);

  try {
    await loadNativeModules();
    const { Camera, CameraResultType, CameraSource } = CameraModule!;
    const photo = await Camera.getPhoto({
      quality: opts?.quality ?? 90,
      width: opts?.maxWidth ?? 1920,
      height: opts?.maxHeight ?? 1920,
      allowEditing: opts?.allowEditing ?? false,
      resultType: CameraResultType.Base64,
      source: CameraSource.Prompt,
      correctOrientation: true,
      promptLabelHeader: 'Foto',
      promptLabelCancel: 'Cancelar',
      promptLabelPhoto: 'Galeria',
      promptLabelPicture: 'Camara',
    });
    if (!photo.base64String) return null;
    const format = photo.format || 'jpeg';
    const mime = getMimeFromFormat(format);
    const fileName = `media_${Date.now()}.${format}`;
    const file = base64ToFile(photo.base64String, fileName, mime);
    const previewUrl = `data:${mime};base64,${photo.base64String}`;
    return { file, previewUrl, source: 'camera' };
  } catch (err: any) {
    if (err?.message?.includes('User cancelled')) return null;
    console.error('[nativeMedia] pickOrTake error:', err);
    return pickImage(opts);
  }
}

export async function saveFileToDevice(
  data: Blob | string, fileName: string, directory?: string
): Promise<string | null> {
  if (!isNativePlatform()) {
    const url = typeof data === 'string' ? data : URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url; a.download = fileName;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    if (typeof data !== 'string') URL.revokeObjectURL(url);
    return fileName;
  }
  try {
    await loadNativeModules();
    const { Filesystem, Directory } = FilesystemModule!;
    let base64Data: string;
    if (typeof data === 'string') { base64Data = data; }
    else {
      const buffer = await data.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      base64Data = btoa(binary);
    }
    const result = await Filesystem.writeFile({
      path: directory ? `${directory}/${fileName}` : fileName,
      data: base64Data, directory: Directory.Documents, recursive: true,
    });
    console.log(`[nativeMedia] Saved to device: ${result.uri}`);
    return result.uri;
  } catch (err) { console.error('[nativeMedia] Save failed:', err); return null; }
}

export async function readFileFromDevice(path: string): Promise<string | null> {
  if (!isNativePlatform()) return null;
  try {
    await loadNativeModules();
    const { Filesystem, Directory, Encoding } = FilesystemModule!;
    const result = await Filesystem.readFile({ path, directory: Directory.Documents, encoding: Encoding.UTF8 });
    return typeof result.data === 'string' ? result.data : null;
  } catch (err) { console.error('[nativeMedia] Read failed:', err); return null; }
}
