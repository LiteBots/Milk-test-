import Image from 'next/image';
import { Icon } from './Icon';

// Zdjęcie produktu/treści z optymalizacją next/image i neutralnym zastępstwem, gdy brak pliku
export function Img({
  src,
  alt,
  sizes = '(max-width: 768px) 100vw, 33vw',
  priority = false,
  className
}: {
  src?: string | null;
  alt: string;
  sizes?: string;
  priority?: boolean;
  className?: string;
}) {
  if (!src) {
    return (
      <div className="placeholder-img" aria-hidden="true">
        <Icon name="cup" size={34} strokeWidth={1.4} />
      </div>
    );
  }
  // Pliki z dawnego /uploads lub zewnętrzne adresy bez konfiguracji – zwykły <img>
  const optimizable = src.startsWith('/api/media/') || src.startsWith('/img/') || src.startsWith('https://res.cloudinary.com/');
  if (!optimizable || src.endsWith('.svg')) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} loading={priority ? 'eager' : 'lazy'} decoding="async" className={className} />;
  }
  return <Image src={src} alt={alt} fill sizes={sizes} priority={priority} className={className} style={{ objectFit: 'cover' }} />;
}
