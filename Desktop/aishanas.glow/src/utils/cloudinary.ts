import type { CloudinaryConfig } from '../types/studio';

export interface CloudinaryUploadResult {
  secureUrl: string;
  publicId: string;
}

/**
 * Optimizes a Cloudinary URL dynamically with f_auto,q_auto if it's a standard res.cloudinary.com URL.
 */
export function optimizeCloudinaryUrl(url?: string, width?: number): string {
  if (!url) return '';
  const marker = '/image/upload/';
  if (!url.includes('res.cloudinary.com') || !url.includes(marker)) {
    return url;
  }
  const transforms = ['f_auto', 'q_auto'];
  if (width) {
    transforms.push(`w_${width}`, 'c_limit');
  }
  const [prefix, suffix] = url.split(marker);
  // Avoid duplicating transforms if already injected
  if (suffix.startsWith('f_auto')) {
    return url;
  }
  return `${prefix}${marker}${transforms.join(',')}/${suffix}`;
}

/**
 * Uploads an image directly from the browser to Cloudinary using an unsigned upload preset.
 */
export async function uploadToCloudinary(
  file: File,
  config: CloudinaryConfig
): Promise<CloudinaryUploadResult> {
  const cloudName = config.cloudName.trim();
  const uploadPreset = config.uploadPreset.trim();

  if (!cloudName || !uploadPreset) {
    throw new Error(
      'Veuillez renseigner le Cloud Name et l’Upload Preset unsigned dans la configuration Cloudinary.'
    );
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', uploadPreset);
  if (config.folder.trim()) {
    formData.append('folder', config.folder.trim());
  }

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`,
    {
      method: 'POST',
      body: formData,
    }
  );

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null);
    const message =
      errorPayload?.error?.message ||
      `Erreur Cloudinary (${response.status}). Vérifiez le Cloud Name et le preset unsigned.`;
    throw new Error(message);
  }

  const data = await response.json();
  return {
    secureUrl: data.secure_url as string,
    publicId: data.public_id as string,
  };
}
