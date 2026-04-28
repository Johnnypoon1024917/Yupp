'use client';

import { useState, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Clipboard } from 'lucide-react';
import { scrapeUrl } from '@/actions/scrapeUrl';
import { geocodeLocation } from '@/actions/geocodeLocation';
import { detectPlatform } from '@/actions/extractPlaces';
import useTravelPinStore from '@/store/useTravelPinStore';
import useToastStore from '@/store/useToastStore';
import type { Pin } from '@/types';

export type MagicBarState = 'idle' | 'processing' | 'error' | 'success';

/**
 * Capitalizes the first letter of a platform name for display.
 */
export function formatPlatformName(platform: string): string {
  if (!platform) return 'Unknown';
  return platform.charAt(0).toUpperCase() + platform.slice(1);
}

export interface MagicBarRef {
  focus: () => void;
  triggerProcess: (url: string) => void;
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
  const inputRef = useRef<HTMLInputElement>(null);
  const isSharedRef = useRef(false);
  const addPin = useTravelPinStore((s) => s.addPin);
  const addToast = useToastStore((s) => s.addToast);

  const resetToIdle = useCallback(() => {
    setState('idle');
    setStatusText('');
    isSharedRef.current = false;
  }, []);

  /**
   * Core processing logic shared by both manual submit and external triggerProcess.
   * Accepts a trimmed URL and an `isShared` flag to differentiate status text.
   */
  const processUrl = useCallback(
    async (trimmed: string, isShared: boolean) => {
      // Validate URL
      if (!isValidUrl(trimmed)) {
        addToast("Please enter a valid URL (e.g. https://example.com)", "error");
        setTimeout(() => { resetToIdle(); }, 300);
        return;
      }

      // Determine initial status text based on source (Req 7.1, 7.2, 7.3)
      let initialStatusText = 'Scanning for multiple spots...';
      if (isShared) {
        const platform = detectPlatform(trimmed);
        if (platform !== 'unknown') {
          const platformDisplay = formatPlatformName(platform);
          initialStatusText = `Shared from ${platformDisplay}! Finding the spot...`;
        }
      }

      // Clear any previous state
      setState('processing');
      setStatusText(initialStatusText);

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
        for (let i = 0; i < geocodeResults.length; i++) {
          const result = geocodeResults[i];
          if (result.status !== 'fulfilled') continue;
          const geocodeResult = result.value;
          if (geocodeResult.status !== 'success') continue;

          const place = scrapeResult.extractedPlaces[i];
          const resolvedImageUrl = scrapeResult.imageUrl ?? '/placeholder-pin.svg';
          const newPin = addPin({
            title: geocodeResult.displayName || place.name || scrapeResult.title,
            // Priority: Google Place name → AI-extracted name → IG title
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
      } catch {
        addToast("Something went wrong. Please try again in a moment.", "error");
        setTimeout(() => { resetToIdle(); }, 300);
      }
    },
    [addPin, onPinCreated, resetToIdle, addToast]
  );

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      const trimmed = text?.trim();
      if (trimmed && isValidUrl(trimmed)) {
        processUrl(trimmed, true);
      }
    } catch {
      // Silently ignore — permission denied or API unavailable
    }
  }, [processUrl]);

  useImperativeHandle(ref, () => ({
    focus: () => {
      inputRef.current?.focus();
    },
    triggerProcess: (url: string) => {
      // Ignore if already processing (Req 6.3) or empty string (Req 6.4)
      if (state === 'processing' || !url || !url.trim()) return;
      const trimmed = url.trim();
      isSharedRef.current = true;
      setInputValue(trimmed);
      processUrl(trimmed, true);
    },
  }), [state, processUrl]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      const trimmed = inputValue.trim();
      if (!trimmed) return;

      isSharedRef.current = false;
      await processUrl(trimmed, false);
    },
    [inputValue, processUrl]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setInputValue(e.target.value);
      // Clear error when user starts typing again
      if (state === 'error') {
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
          <>
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
            <button
              type="button"
              onClick={handlePaste}
              className="ml-2 flex-shrink-0 text-gray-400 hover:text-accent transition-colors"
              aria-label="Paste from clipboard"
            >
              <Clipboard size={16} />
            </button>
          </>
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

    </div>
  );
});

export default MagicBar;
