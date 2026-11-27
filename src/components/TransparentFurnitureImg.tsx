import React, { useEffect, useState } from 'react';
import { removeWhiteBackground } from '../utils/chromaKey.ts';

interface TransparentFurnitureImgProps {
  src: string;
  alt: string;
  className?: string;
  draggable?: boolean;
}

export const TransparentFurnitureImg: React.FC<TransparentFurnitureImgProps> = ({
  src,
  alt,
  className = '',
  draggable = false,
}) => {
  const [cleanSrc, setCleanSrc] = useState<string>(src);

  useEffect(() => {
    let mounted = true;
    setCleanSrc(src);
    if (src.startsWith('data:image/svg+xml')) {
      return () => {
        mounted = false;
      };
    }
    removeWhiteBackground(src).then((processed) => {
      if (mounted && processed) {
        setCleanSrc(processed);
      }
    });
    return () => {
      mounted = false;
    };
  }, [src]);

  return (
    <img
      src={cleanSrc}
      alt={alt}
      referrerPolicy="no-referrer"
      draggable={draggable}
      className={className}
    />
  );
};
