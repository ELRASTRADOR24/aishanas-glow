import type { CloudinaryConfig } from '../types/studio';

export interface CloudinaryUploadResult {
  secureUrl: string;
  publicId: string;
  resourceType: 'image' | 'video' | 'auto';
}

/**
 * Checks if a given media URL is a video.
 * Handles uppercase extensions, query strings, hashes, and Cloudinary video URLs.
 */
export function isVideoUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const clean = url.toLowerCase().split('?')[0].split('#')[0].trim();
  return (
    clean.includes('/video/upload/') ||
    clean.endsWith('.mp4') ||
    clean.endsWith('.webm') ||
    clean.endsWith('.mov') ||
    clean.endsWith('.m4v') ||
    clean.endsWith('.ogg') ||
    clean.endsWith('.quicktime')
  );
}

/**
 * Optimizes a Cloudinary URL dynamically with f_auto,q_auto if it's a standard res.cloudinary.com URL.
 * Safely guards against non-strings, double transforms, invalid widths, and video URLs.
 */
export function optimizeCloudinaryUrl(url?: string | null, width?: number): string {
  if (!url || typeof url !== 'string') return '';
  if (isVideoUrl(url)) return url;
  const marker = '/image/upload/';
  const idx = url.indexOf(marker);
  if (idx === -1 || !url.includes('res.cloudinary.com')) {
    return url;
  }
  const prefix = url.substring(0, idx);
  const suffix = url.substring(idx + marker.length);
  if (!suffix || suffix.startsWith('f_auto') || suffix.includes('f_auto,q_auto')) {
    return url;
  }
  const transforms = ['f_auto', 'q_auto'];
  if (typeof width === 'number' && Number.isFinite(width) && width > 0) {
    transforms.push(`w_${Math.round(width)}`, 'c_limit');
  }
  return `${prefix}${marker}${transforms.join(',')}/${suffix}`;
}

/**
 * Uploads an image or video directly from the browser to Cloudinary using an unsigned upload preset.
 * Uses the auto endpoint to support images, videos, reels, and stories.
 */
export async function uploadToCloudinary(
  file: File,
  config?: CloudinaryConfig | null
): Promise<CloudinaryUploadResult> {
  const cloudName = (config?.cloudName || '').trim();
  const uploadPreset = (config?.uploadPreset || '').trim();

  if (!cloudName || !uploadPreset) {
    throw new Error(
      'Veuillez renseigner le Cloud Name et l’Upload Preset unsigned dans l’onglet « Photos & Paramètres » de l’administration.'
    );
  }

  if (!file || file.size === 0) {
    throw new Error('Le fichier sélectionné est vide ou invalide.');
  }

  // Sécurité anti-crash : taille maximale 100 Mo
  const maxSizeBytes = 100 * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    throw new Error('Le fichier dépasse la taille maximale autorisée de 100 Mo.');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', uploadPreset);
  const folder = (config?.folder || '').trim();
  if (folder) {
    formData.append('folder', folder);
  }

  // Cloudinary auto/upload endpoint supports images and videos seamlessly
  const isVideo = file.type?.startsWith('video/') || isVideoUrl(file.name);
  const endpointType = isVideo ? 'video' : 'auto';

  let response: Response;
  try {
    response = await fetch(
      `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/${endpointType}/upload`,
      {
        method: 'POST',
        body: formData,
      }
    );
  } catch (netErr: any) {
    throw new Error(
      `Impossible de joindre Cloudinary. Vérifiez votre connexion Internet (${netErr?.message || 'Erreur réseau'}).`
    );
  }

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null);
    const message =
      errorPayload?.error?.message ||
      `Erreur Cloudinary (${response.status}). Vérifiez que le preset « ${uploadPreset} » existe et est configuré en mode « Unsigned ».`;
    throw new Error(message);
  }

  const data = await response.json();
  return {
    secureUrl: data.secure_url as string,
    publicId: data.public_id as string,
    resourceType: (data.resource_type as 'image' | 'video') || (isVideo ? 'video' : 'image'),
  };
}
