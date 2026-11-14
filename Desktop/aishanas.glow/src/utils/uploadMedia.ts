/**
 * Utilitaires de téléversement et d'optimisation média Cloudinary pour Alshana's Glow.
 * Inspiré du moteur robuste et éprouvé de YDM Coiffure.
 */
import type { CloudinaryConfig } from '../types/studio';
import { isVideoUrl } from './cloudinary';

export interface UploadProgressCallback {
  (percent: number): void;
}

export interface UploadMediaResult {
  success: boolean;
  url: string;
  rawUrl: string;
  thumbnailUrl: string;
  isVideo: boolean;
  publicId: string;
  format?: string;
  bytes?: number;
}

/**
 * Optimise une URL Cloudinary pour garantir une diffusion ultra-légère et fluide
 * (MP4 H.264/VC auto max 1080p pour les vidéos, WebP/AVIF auto pour les images).
 */
export function optimizeCloudinaryMediaUrl(url: string, isVideo = false): string {
  if (!url || typeof url !== 'string') return url;
  if (!url.includes('res.cloudinary.com') || !url.includes('/upload/')) {
    return url;
  }

  const [prefix, rest] = url.split('/upload/');
  if (!rest) return url;
  const firstSegment = rest.split('/')[0] || '';
  const alreadyTransformed =
    firstSegment.includes('q_auto') ||
    firstSegment.includes('f_auto') ||
    firstSegment.includes('vc_auto') ||
    firstSegment.includes('c_limit');

  if (alreadyTransformed) {
    return isVideo ? url.replace(/\.[^/.?#]+(\?.*)?$/, '.mp4$1') : url;
  }

  if (isVideo) {
    const cleanRest = rest.replace(/\.[^/.?#]+(\?.*)?$/, '.mp4$1');
    return `${prefix}/upload/c_limit,w_1080/q_auto:good,vc_auto/${cleanRest}`;
  }

  return `${prefix}/upload/c_limit,w_1600/f_auto,q_auto:good/${rest}`;
}

/**
 * Génère la vignette JPG optimisée (première image) d'une vidéo Cloudinary.
 */
export function buildCloudinaryVideoThumbnail(url: string): string {
  if (!url || typeof url !== 'string') return url;
  if (!url.includes('res.cloudinary.com') || !url.includes('/upload/')) {
    return url.replace(/\.[^/.?#]+(\?.*)?$/, '.jpg$1');
  }

  const [prefix, rest] = url.split('/upload/');
  if (!rest) return url.replace(/\.[^/.?#]+(\?.*)?$/, '.jpg$1');

  const versionMatch = rest.match(/(?:^|\/)(v\d+\/.+)$/);
  const tail = versionMatch ? versionMatch[1] : rest;
  const jpgTail = tail.replace(/\.[^/.?#]+(\?.*)?$/, '.jpg$1');

  return `${prefix}/upload/c_limit,q_auto,so_0,w_900/${jpgTail}`;
}

/**
 * Téléversement direct avec suivi de progression réel en pourcentage (XHR).
 */
function uploadWithXhrProgress(
  endpoint: string,
  formData: FormData,
  onProgress?: UploadProgressCallback
): Promise<any> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', endpoint);

    if (xhr.upload && typeof onProgress === 'function') {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && event.total > 0) {
          const pct = Math.min(99, Math.round((event.loaded / event.total) * 100));
          onProgress(pct);
        }
      };
    }

    xhr.onload = () => {
      try {
        const parsed = JSON.parse(xhr.responseText || '{}');
        if (xhr.status >= 200 && xhr.status < 300) {
          if (typeof onProgress === 'function') onProgress(100);
          resolve(parsed);
        } else {
          reject(new Error(parsed?.error?.message || parsed?.error || 'Erreur Cloudinary'));
        }
      } catch {
        reject(new Error("Réponse invalide lors de l'envoi sur Cloudinary."));
      }
    };

    xhr.onerror = () => reject(new Error('Erreur de connexion réseau pendant le téléversement.'));
    xhr.send(formData);
  });
}

/**
 * Téléversement universel d'une image ou vidéo vers Cloudinary
 * avec barre de progression en temps réel (0% à 100%).
 */
export async function uploadMediaWithProgress(
  file: File | Blob,
  fileName: string,
  config?: CloudinaryConfig | null,
  onProgress?: UploadProgressCallback
): Promise<UploadMediaResult> {
  const cloudName = (
    config?.cloudName ||
    (typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_CLOUDINARY_CLOUD_NAME : '') ||
    'dvecpg1tz'
  ).trim();

  const uploadPreset = (
    config?.uploadPreset ||
    (typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_CLOUDINARY_UPLOAD_PRESET : '') ||
    'alshanas_unsigned'
  ).trim();

  const folder = (
    config?.folder ||
    (typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_CLOUDINARY_FOLDER : '') ||
    'alshanas-glow'
  ).trim();

  if (!cloudName || !uploadPreset) {
    throw new Error(
      "Configuration Cloudinary manquante : veuillez vérifier les identifiants dans l'onglet Paramètres."
    );
  }

  const isVideo =
    (file.type && file.type.startsWith('video/')) ||
    isVideoUrl(fileName) ||
    /\.(mp4|mov|m4v|webm|avi|3gp)$/i.test(fileName);

  const endpointType = isVideo ? 'video' : 'auto';
  const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/${endpointType}/upload`;

  const formData = new FormData();
  formData.append('file', file, fileName);
  formData.append('upload_preset', uploadPreset);
  if (folder) {
    formData.append('folder', folder);
  }

  const cloudData = await uploadWithXhrProgress(endpoint, formData, onProgress);
  const rawUrl = cloudData.secure_url || cloudData.url;
  const optimizedUrl = optimizeCloudinaryMediaUrl(rawUrl, isVideo);
  const thumbnailUrl = isVideo ? buildCloudinaryVideoThumbnail(rawUrl) : optimizedUrl;

  return {
    success: true,
    url: optimizedUrl,
    rawUrl,
    thumbnailUrl,
    isVideo,
    publicId: cloudData.public_id || `id-${Date.now()}`,
    format: cloudData.format || (isVideo ? 'mp4' : 'webp'),
    bytes: cloudData.bytes,
  };
}
