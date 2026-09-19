import { api } from './api-client';

// Link Drive dạng /file/d/ID/view không nhúng <img> được -> đổi sang thumbnail.
// R2 / link ảnh thường giữ nguyên.
export function viewUrl(url: string, size = 'w800'): string {
  if (!url) return url;
  const m = url.match(/drive\.google\.com\/(?:file\/d\/|thumbnail\?id=)([a-zA-Z0-9_-]+)/);
  if (m) return `https://drive.google.com/thumbnail?id=${m[1]}&sz=${size}`;
  const m2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m2 && url.includes('drive.google.com')) return `https://drive.google.com/thumbnail?id=${m2[1]}&sz=${size}`;
  return url;
}

// Resize ảnh ở client trước khi đẩy R2: full giữ nguyên, thumb max 400px (fix agient 4.5).
export async function makeThumbnail(file: File, max = 400): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('thumb fail'))), 'image/jpeg', 0.8));
}

export async function uploadImage(file: File, folder = 'orders'): Promise<{ url: string; thumbnailUrl: string }> {
  const up = async (blob: Blob | File, name: string, type: string) => {
    const p = await api('/uploads/presign', { method: 'POST', body: JSON.stringify({ filename: name, contentType: type, folder }) });
    const put = await fetch(p.uploadUrl, { method: 'PUT', body: blob, headers: { 'Content-Type': type } });
    if (!put.ok) throw new Error(`R2 trả ${put.status}`);
    return p.publicUrl as string;
  };
  const url = await up(file, file.name, file.type || 'image/jpeg');
  let thumbnailUrl = url;
  try {
    const thumb = await makeThumbnail(file);
    thumbnailUrl = await up(thumb, 'thumb_' + file.name.replace(/\.\w+$/, '') + '.jpg', 'image/jpeg');
  } catch { /* rớt thumb vẫn giữ ảnh gốc */ }
  return { url, thumbnailUrl };
}
