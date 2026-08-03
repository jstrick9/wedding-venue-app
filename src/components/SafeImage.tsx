import React, { useEffect, useMemo, useState } from 'react';
import type { ImageItem } from '../types';
import { getFirstRenderableImage } from '../utils/renderGuards';
import { isStoragePathRef, resolveImageRef } from '../services/storage/imageStorage';

interface SafeImageProps {
  src?: string;
  images?: ImageItem[];
  alt: string;
  className?: string;
  fallback?: React.ReactNode;
}

export const SafeImage: React.FC<SafeImageProps> = ({
  src,
  images,
  alt,
  className = '',
  fallback = (
    <div className="flex items-center justify-center bg-gray-100 text-gray-500 text-sm">
      No image
    </div>
  ),
}) => {
  const [failed, setFailed] = useState(false);
  const [resolvedSrc, setResolvedSrc] = useState<string | undefined>();
  const selected = useMemo(() => getFirstRenderableImage(src, images), [src, images]);

  // Resolve storage path refs (sp://bucket/path) to a displayable signed URL.
  // Data URLs and normal URLs pass through unchanged.
  useEffect(() => {
    let cancelled = false;
    setResolvedSrc(undefined);
    if (selected && isStoragePathRef(selected.url)) {
      resolveImageRef(selected.url)
        .then((url) => { if (!cancelled) setResolvedSrc(url); })
        .catch(() => { if (!cancelled) setResolvedSrc(undefined); });
    }
    return () => { cancelled = true; };
  }, [selected]);

  if (!selected || failed) {
    return <>{fallback}</>;
  }

  // A storage path ref that hasn't resolved yet shouldn't render a broken <img>.
  if (isStoragePathRef(selected.url) && resolvedSrc === undefined) {
    return <>{fallback}</>;
  }

  return (
    <img
      src={resolvedSrc ?? selected.url}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
      loading="lazy"
    />
  );
};

export default SafeImage;