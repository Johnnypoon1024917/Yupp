'use client';

import Image from 'next/image';
import { MapPin } from 'lucide-react';
import { useState, useCallback } from 'react';
import { DURATION_BASE } from '@/utils/motion';

export interface PinImageProps {
  src: string;
  alt: string;
  pinId: string;
  aspectRatio?: string;
  className?: string;
  sizes?: string;
}

const WHITELISTED_PATTERNS = [
  'cdninstagram.com',
  'xiaohongshu.com',
  'douyinpic.com',
  'tiktokcdn.com',
  'tiktokcdn-us.com',
  'googleapis.com',
  'supabase.co',
];

/** Checks if a URL's hostname matches any whitelisted pattern from next.config.mjs */
function isWhitelistedHost(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return WHITELISTED_PATTERNS.some((pattern) => hostname.endsWith(pattern));
  } catch {
    return false;
  }
}

/** Simple string hash → hue for deterministic gradient placeholders. */
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0; // Convert to 32-bit int
  }
  return Math.abs(hash);
}

function hueFromPinId(pinId: string): number {
  return hashCode(pinId) % 360;
}

function gradientStyle(pinId: string): React.CSSProperties {
  const hue = hueFromPinId(pinId);
  return {
    background: `linear-gradient(135deg, hsl(${hue}, 60%, 75%), hsl(${(hue + 40) % 360}, 50%, 60%))`,
  };
}

export default function PinImage({
  src,
  alt,
  pinId,
  aspectRatio = '4/5',
  className = '',
  sizes,
}: PinImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  const handleLoad = useCallback(() => setLoaded(true), []);
  const handleError = useCallback(() => setErrored(true), []);

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{ aspectRatio }}
    >
      {/* Gradient placeholder — always rendered behind the image */}
      <div
        className="absolute inset-0"
        style={gradientStyle(pinId)}
        aria-hidden="true"
      />

      {/* Error fallback icon */}
      {errored && (
        <div className="absolute inset-0 flex items-center justify-center">
          <MapPin className="h-8 w-8 text-white/70" aria-hidden="true" />
        </div>
      )}

      {/* Actual image — fades in on load */}
      {!errored && isWhitelistedHost(src) && (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes ?? '(max-width: 768px) 50vw, 33vw'}
          className="object-cover"
          style={{
            opacity: loaded ? 1 : 0,
            transition: `opacity ${DURATION_BASE}s ease`,
          }}
          onLoad={handleLoad}
          onError={handleError}
        />
      )}

      {/* Fallback <img> for non-whitelisted hosts */}
      {!errored && !isWhitelistedHost(src) && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={src}
          alt={alt}
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            opacity: loaded ? 1 : 0,
            transition: `opacity ${DURATION_BASE}s ease`,
          }}
          onLoad={handleLoad}
          onError={handleError}
        />
      )}
    </div>
  );
}
