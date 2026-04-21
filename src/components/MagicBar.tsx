'use client';

import { useState, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { scrapeUrl } from '@/actions/scrapeUrl';
import { geocodeLocation } from '@/actions/geocodeLocation';
import useTravelPinStore from '@/store/useTravelPinStore';
import useToastStore from '@/store/useToastStore';
import type { Pin } from '@/types';

export type MagicBarState = 'idle' | 'processing' | 'needs_input' | 'error' | 'success';

/**
 * Capitalizes the first letter of a platform name for display.
 */
export function formatPlatformName(platform: string): string {
  if (!platform) return 'Unknown';
  return platform.charAt(0).toUpperCase() + platform.slice(1);
}

export interface MagicBarRef {
  focus: () => void;
}

export interface MagicBarProps {
  onPinCreated?: (pin: Pin) => void;
}

/**
 * Validates whether a string is a well-formed URL with http(s) protocol.
 */
export function isValidUrl(input: string): boolean {
  try {
    const url = new URL(input.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

const MagicBar = forwardRef<MagicBarRef, MagicBarProps>(function MagicBar({ onPinCreated }, ref) {
  const [state, setState] = useState<MagicBarState>('idle');
  const [inputValue, setInputValue] = useState('');
  const [statusText, setStatusText] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [partialData, setPartialData] = useState<{ title: string; imageUrl: string | null } | null>(null);
  const [clarificationValue, setClarificationValue] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const addPin = useTravelPinStore((s) => s.addPin);
  const addToast = useToastStore((s) => s.addToast);

  useImperativeHandle(ref, () => ({
    focus: () => {
      inputRef.current?.focus();
    },
  }), []);

  const resetToIdle = useCallback(() => {
    setState('idle');
    setStatusText('');
    setPartialData(null);
    setClarificationValue('');
    setSourceUrl('');
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      const trimmed = inputValue.trim();
      if (!trimmed) return;

      // Validate URL
      if (!isValidUrl(trimmed)) {
        addToast("Please enter a valid URL (e.g. https://example.com)", "error");
        setTimeout(() => { resetToIdle(); }, 300);
        return;
      }

      // Clear any previous state
      setState('processing');
      setStatusText('Scanning for multiple spots...');

      try {
        // Step 1: Scrape the URL
        const scrapeResult = await scrapeUrl(trimmed);
        if (!scrapeResult.success) {
          addToast("We couldn't read that link. Try pasting a different one.", "error");
          setTimeout(() => { resetToIdle(); }, 300);
          return;
        }

        // Step 2: Check for extracted places
        if (scrapeResult.extractedPlaces.length === 0) {
          addToast("No places found in this post.", "error");
          setTimeout(() => { resetToIdle(); }, 300);
          return;
        }

        // Step 3: Batch geocode all extracted places in parallel
        setStatusText('Pinning spots...');
        const geocodeResults = await Promise.allSettled(
          scrapeResult.extractedPlaces.map((place) =>
            geocodeLocation({
              location: place.name,
              contextualHints: place.contextualHints,
              partialData: { title: scrapeResult.title, imageUrl: scrapeResult.imageUrl },
            })
          )
        );

        // Step 4: Add pins for each successfully geocoded place
        let pinnedCount = 0;
        let usedPlaceholder = false;
        for (const result of geocodeResults) {
          if (result.status !== 'fulfilled') continue;
          const geocodeResult = result.value;
          if (geocodeResult.status !== 'success') continue;

          const resolvedImageUrl = scrapeResult.imageUrl ?? '/placeholder-pin.svg';
          const newPin = addPin({
            title: scrapeResult.title,
            description: scrapeResult.description ?? undefined,
            imageUrl: resolvedImageUrl,
            sourceUrl: scrapeResult.sourceUrl,
            latitude: geocodeResult.lat,
            longitude: geocodeResult.lng,
            address: geocodeResult.address,
            placeId: geocodeResult.enrichedData.placeId,
            primaryType: geocodeResult.enrichedData.primaryType,
            rating: geocodeResult.enrichedData.rating,
          });
          onPinCreated?.(newPin);
          if (!scrapeResult.imageUrl) {
            usedPlaceholder = true;
          }
          pinnedCount++;
        }

        if (pinnedCount > 0) {
          const platformDisplay = formatPlatformName(scrapeResult.platform);
          setStatusText(`Pinned ${pinnedCount} spots from ${platformDisplay}!`);
          setState('success');
          setInputValue('');
          if (usedPlaceholder) {
            addToast("Image couldn't be loaded from this link — we used a placeholder instead.", "error");
          }
          setTimeout(() => {
            resetToIdle();
          }, 2000);
        } else {
          addToast("Our AI is currently taking a coffee break. We saved the link to your unorganized collection instead!", "error");
          setTimeout(() => { resetToIdle(); }, 300);
        }
      } catch (err) {
        addToast("Something went wrong. Please try again in a moment.", "error");
        setTimeout(() => { resetToIdle(); }, 300);
      }
    },
    [inputValue, addPin, onPinCreated, resetToIdle, addToast]
  );

  const handleClarificationSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      const trimmed = clarificationValue.trim();
      if (!trimmed) return;

      try {
        const geocodeResult = await geocodeLocation({ location: trimmed });

        if (geocodeResult.status === 'success') {
          const newPin = addPin({
            title: partialData?.title ?? '',
            imageUrl: partialData?.imageUrl ?? '/placeholder-pin.svg',
            sourceUrl,
            latitude: geocodeResult.lat,
            longitude: geocodeResult.lng,
            address: geocodeResult.address,
            placeId: geocodeResult.enrichedData.placeId,
            primaryType: geocodeResult.enrichedData.primaryType,
            rating: geocodeResult.enrichedData.rating,
          });
          onPinCreated?.(newPin);
          setState('success');
          setInputValue('');
          setClarificationValue('');
          setTimeout(() => {
            resetToIdle();
          }, 600);
        }
        // On ERROR or NEEDS_USER_INPUT, stay in needs_input state
      } catch {
        // Stay in needs_input state on unexpected errors
      }
    },
    [clarificationValue, partialData, sourceUrl, addPin, onPinCreated, resetToIdle]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setInputValue(e.target.value);
      // Clear error or needs_input when user starts typing again
      if (state === 'error' || state === 'needs_input') {
        resetToIdle();
      }
    },
    [state, resetToIdle]
  );

  const isProcessing = state === 'processing';
  const showStatusText = state === 'processing' || (state === 'success' && statusText);

  return (
    <div className="fixed top-[max(1rem,env(safe-area-inset-top))] left-1/2 -translate-x-1/2 z-[40] flex flex-col items-center w-[90%] max-w-[400px]">
      <motion.form
        onSubmit={handleSubmit}
        layout
        animate={{ width: isFocused ? '100%' : 'min(400px, 100%)' }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className="relative flex items-center w-full rounded-full border border-border bg-surface/80 backdrop-blur-md shadow-xl px-4 py-2"
      >
        {/* Sparkle icon — visible during processing or success */}
        <AnimatePresence>
          {showStatusText && (
            <motion.span
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={{ duration: 0.25 }}
              className="mr-2 flex-shrink-0"
              aria-hidden
            >
              <motion.span
                animate={{ rotate: [0, 15, -15, 0], scale: [1, 1.2, 1] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                className="inline-block text-accent"
              >
                <Sparkles size={16} />
              </motion.span>
            </motion.span>
          )}
        </AnimatePresence>

        {/* Input field — hidden during processing/success, replaced by animated status text */}
        {showStatusText ? (
          <motion.span
            key="processing-text"
            initial={{ opacity: 0 }}
            animate={isProcessing ? { opacity: [0.5, 1, 0.5] } : { opacity: 1 }}
            transition={isProcessing ? { duration: 1.8, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.3 }}
            className="flex-1 text-sm text-accent font-medium select-none"
            role="status"
            aria-live="polite"
          >
            {statusText || 'Processing…'}
          </motion.span>
        ) : (
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleChange}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            disabled={isProcessing}
            placeholder="Paste a URL to pin a place..."
            aria-label="Paste a URL to create a travel pin"
            className="flex-1 bg-transparent outline-none text-sm sm:text-base text-primary placeholder:text-gray-400"
          />
        )}

        {/* Shimmer bar — subtle gradient sweep across the bar during processing */}
        <AnimatePresence>
          {isProcessing && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 rounded-full overflow-hidden pointer-events-none"
              aria-hidden
            >
              <motion.div
                className="absolute inset-0"
                style={{
                  background:
                    'linear-gradient(90deg, transparent 0%, rgba(99,102,241,0.08) 50%, transparent 100%)',
                }}
                animate={{ x: ['-100%', '100%'] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.form>

      {/* Needs-input clarification UI */}
      <AnimatePresence>
        {state === 'needs_input' && partialData && (
          <motion.div
            layout
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="mt-2 w-full rounded-2xl border border-border bg-surface/80 backdrop-blur-md shadow-sm p-4"
          >
            <form onSubmit={handleClarificationSubmit} className="flex items-start gap-3">
              {/* Thumbnail */}
              {partialData.imageUrl ? (
                <img
                  src={partialData.imageUrl}
                  alt={partialData.title}
                  className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-gray-200 flex-shrink-0" />
              )}

              {/* Prompt + Input */}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-primary font-medium leading-snug">
                  We saved the vibe! Where exactly is this?
                </p>
                <input
                  type="text"
                  value={clarificationValue}
                  onChange={(e) => setClarificationValue(e.target.value)}
                  placeholder="Type a venue or address…"
                  aria-label="Clarify the location by typing a venue name or address"
                  className="mt-2 w-full bg-transparent border border-border rounded-lg px-3 py-1.5 text-sm text-primary placeholder:text-gray-400 outline-none focus:ring-1 focus:ring-accent"
                  autoFocus
                />
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

export default MagicBar;
