import 'server-only';
import crypto from 'crypto';
import { Media } from './models';

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif', 'image/svg+xml'];
export const MAX_UPLOAD = 8 * 1024 * 1024;

// Zapis zdjęcia: Cloudinary (jeśli skonfigurowane) albo MongoDB – pliki nie znikają przy wdrożeniu
export async function saveImage(file: File): Promise<string> {
  if (!ALLOWED.includes(file.type)) throw new Error('Dozwolone są tylko obrazy JPG, PNG, WEBP, AVIF, GIF.');
  if (file.size > MAX_UPLOAD) throw new Error('Plik jest za duży (max 8 MB).');
  const buf = Buffer.from(await file.arrayBuffer());

  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  const key = process.env.CLOUDINARY_API_KEY;
  const secret = process.env.CLOUDINARY_API_SECRET;
  if (cloud && key && secret) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const folder = 'milkmi';
    const signature = crypto.createHash('sha1').update(`folder=${folder}&timestamp=${timestamp}${secret}`).digest('hex');
    const form = new FormData();
    form.append('file', new Blob([buf], { type: file.type }), file.name);
    form.append('api_key', key);
    form.append('timestamp', timestamp);
    form.append('folder', folder);
    form.append('signature', signature);
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, { method: 'POST', body: form });
    const data = (await res.json()) as { secure_url?: string; error?: { message: string } };
    if (!data.secure_url) throw new Error(data.error?.message || 'Błąd wysyłania do Cloudinary.');
    return data.secure_url;
  }

  const doc = await Media.create({ filename: file.name, contentType: file.type, size: file.size, data: buf });
  return `/api/media/${doc._id.toString()}`;
}
