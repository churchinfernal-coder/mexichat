/**
 * useContentCreation — Create content on MexiVanza (posts, listings, videos)
 *
 * Handles: media upload to storage, DB insert, optimistic UI refresh.
 * Requires user to be authenticated on MexiVanza (via mexivanzaSync).
 */

import { useState, useCallback } from 'react';
import { mexivanza } from '@/integrations/mexivanza/client';

// ═══ Enterprise Validators & Media Type Constants ═══

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];
const MEDIA_TYPES = [...IMAGE_TYPES, ...VIDEO_TYPES];

/** Validate text content — XSS prevention + length enforcement */
function validateTextContent(text: string, fieldName: string): void {
  if (!text || typeof text !== 'string') throw new Error(`${fieldName}: contenido requerido`);
  const trimmed = text.trim();
  if (trimmed.length < 1) throw new Error(`${fieldName}: contenido requerido`);
  if (trimmed.length > 5000) throw new Error(`${fieldName}: maximo 5000 caracteres`);
  // Block script injection
  if (/<script/i.test(trimmed)) throw new Error(`${fieldName}: contenido no permitido`);
}

/** Validate file size in MB */
function validateFileSize(file: File, maxMB: number): void {
  if (!file) throw new Error('Archivo requerido');
  const sizeMB = file.size / (1024 * 1024);
  if (sizeMB > maxMB) throw new Error(`Archivo muy grande: ${sizeMB.toFixed(1)}MB (max ${maxMB}MB)`);
  if (file.size === 0) throw new Error('Archivo vacio');
}

/** Validate file MIME type against allowed list */
function validateFileType(file: File, allowedTypes: string[]): void {
  if (!file) throw new Error('Archivo requerido');
  if (!allowedTypes.includes(file.type)) {
    throw new Error(`Tipo de archivo no permitido: ${file.type}`);
  }
}



// ─── Media Upload ───────────────────────────────────────────────────────────

async function uploadMedia(
  file: File,
  bucket: 'media' | 'videos',
  folder: string,
): Promise<string> {
  const ext = file.name.split('.').pop() || 'bin';
  const fileName = `${folder}/${crypto.randomUUID()}.${ext}`;

  const { error } = await mexivanza.storage.from(bucket).upload(fileName, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type,
  });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  const { data } = mexivanza.storage.from(bucket).getPublicUrl(fileName);
  return data.publicUrl;
}

async function uploadMultipleMedia(
  files: File[],
  bucket: 'media' | 'videos' = 'media',
  folder = 'posts',
): Promise<string[]> {
  const urls: string[] = [];
  for (const file of files) {
    const url = await uploadMedia(file, bucket, folder);
    urls.push(url);
  }
  return urls;
}

// ─── Get current MexiVanza user ─────────────────────────────────────────────

async function getMexivanzaUserId(): Promise<string> {
  const { data: { user } } = await mexivanza.auth.getUser();
  if (!user?.id) throw new Error('No autenticado en MexiVanza. Cierra sesión y vuelve a iniciar.');
  return user.id;
}

// ─── Create Social Post ─────────────────────────────────────────────────────

export interface CreatePostInput {
  caption: string;
  files?: File[];
  visibility?: 'public' | 'followers' | 'private';
  hashtags?: string[];
  type?: 'text' | 'image' | 'video' | 'mixed';
}

async function createSocialPost(input: CreatePostInput): Promise<void> {
  validateTextContent(input.caption, "publicacion");
  if (input.files) input.files.forEach(function(f) { validateFileSize(f, 20); validateFileType(f, MEDIA_TYPES); });
  const userId = await getMexivanzaUserId();

  let mediaUrls: { url: string; type: string }[] = [];
  if (input.files && input.files.length > 0) {
    const urls = await uploadMultipleMedia(input.files, 'media', 'posts');
    mediaUrls = urls.map((url, i) => ({
      url,
      type: input.files![i].type.startsWith('video/') ? 'video' : 'image',
    }));
  }

  const postType = mediaUrls.length === 0
    ? 'text'
    : mediaUrls.some((m) => m.type === 'video')
      ? 'video'
      : 'image';

  // Extract hashtags from caption
  const captionTags = (input.caption.match(/#\w+/g) || []).map((t) => t.slice(1));
  const allTags = [...new Set([...captionTags, ...(input.hashtags || [])])];

  const { error } = await mexivanza.from('user_posts').insert({
    user_id: userId,
    caption: input.caption.trim(),
    content: input.caption.trim(),
    media_urls: mediaUrls.length > 0 ? mediaUrls : null,
    type: postType,
    content_type: postType,
    visibility: input.visibility || 'public',
    hashtags: allTags.length > 0 ? allTags : null,
    likes_count: 0,
    comments_count: 0,
    shares_count: 0,
    view_count: 0,
  });

  if (error) throw new Error(`Error creando publicación: ${error.message}`);
}

// ─── Create MexiMart Listing ────────────────────────────────────────────────

export interface CreateListingInput {
  title: string;
  description: string;
  price: number;
  category: string;
  condition: 'new' | 'like_new' | 'good' | 'fair' | 'used';
  location?: string;
  files?: File[];
  tags?: string[];
}

async function createMeximartListing(input: CreateListingInput): Promise<void> {
  validateTextContent(input.title, "titulo");
  validateTextContent(input.description, "descripcion");
  if (input.price < 0 || input.price > 999999) throw new Error("Precio invalido");
  if (input.files) input.files.forEach(function(f) { validateFileSize(f, 20); validateFileType(f, IMAGE_TYPES); });
  const userId = await getMexivanzaUserId();

  let imageUrls: string[] = [];
  if (input.files && input.files.length > 0) {
    imageUrls = await uploadMultipleMedia(input.files, 'media', 'meximart');
  }

  const { error } = await mexivanza.from('meximart_listings').insert({
    seller_id: userId,
    title: input.title.trim(),
    description: input.description.trim(),
    price: input.price,
    category: input.category,
    condition: input.condition,
    location: input.location?.trim() || null,
    images: imageUrls.length > 0 ? imageUrls : null,
    tags: input.tags || null,
    is_active: true,
    status: 'active',
  });

  if (error) throw new Error(`Error creando artículo: ${error.message}`);
}

// ─── Create Video ───────────────────────────────────────────────────────────

export interface CreateVideoInput {
  caption: string;
  videoFile: File;
  thumbnailFile?: File;
  hashtags?: string[];
  visibility?: 'public' | 'followers' | 'private';
}

async function createVideo(input: CreateVideoInput): Promise<void> {
  validateTextContent(input.caption, "descripcion del video");
  validateFileSize(input.videoFile, 100);
  validateFileType(input.videoFile, VIDEO_TYPES);
  if (input.thumbnailFile) { validateFileSize(input.thumbnailFile, 10); validateFileType(input.thumbnailFile, IMAGE_TYPES); }
  const userId = await getMexivanzaUserId();

  const videoUrl = await uploadMedia(input.videoFile, 'videos', 'uploads');

  let thumbnailUrl: string | null = null;
  if (input.thumbnailFile) {
    thumbnailUrl = await uploadMedia(input.thumbnailFile, 'media', 'thumbnails');
  }

  const captionTags = (input.caption.match(/#\w+/g) || []).map((t) => t.slice(1));
  const allTags = [...new Set([...captionTags, ...(input.hashtags || [])])];

  const { error } = await mexivanza.from('user_videos').insert({
    creator_id: userId,
    video_url: videoUrl,
    thumbnail_url: thumbnailUrl,
    caption: input.caption.trim(),
    hashtags: allTags.length > 0 ? allTags : null,
    visibility: input.visibility || 'public',
    likes_count: 0,
    comments_count: 0,
    shares_count: 0,
    views_count: 0,
    is_active: true,
  });

  if (error) throw new Error(`Error subiendo video: ${error.message}`);
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useContentCreation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>('');

  const submitPost = useCallback(async (input: CreatePostInput) => {
    setLoading(true);
    setError(null);
    try {
      setProgress(input.files?.length ? 'Subiendo archivos...' : 'Publicando...');
      await createSocialPost(input);
      setProgress('¡Publicado!');
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const submitListing = useCallback(async (input: CreateListingInput) => {
    setLoading(true);
    setError(null);
    try {
      setProgress(input.files?.length ? 'Subiendo fotos...' : 'Creando artículo...');
      await createMeximartListing(input);
      setProgress('?Artículo publicado!');
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const submitVideo = useCallback(async (input: CreateVideoInput) => {
    setLoading(true);
    setError(null);
    try {
      setProgress('Subiendo video...');
      await createVideo(input);
      setProgress('¡Video publicado!');
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, error, progress, submitPost, submitListing, submitVideo };
}