'use client';

import { useState, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { scrapeUrl } from '@/actions/scrapeUrl';
import { geocodeLocation } from '@/actions/geocodeLocation';
import useTravelPinStore from '@/store/useTravelPinStore';
import type { Pin } from '@/types';

export type MagicBarState = 'idle' | 'processing' | 'needs_input' | 'error' | 'success';

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
  const [errorMessage, setErrorMessage] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [partialData, setPartialData] = useState<{ title: string; imageUrl: string | null } | null>(null);
  const [clarificationValue, setClarificationValue] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const addPin = useTravelPinStore((s) => s.addPin);

  useImperativeHandle(ref, () => ({
    focus: () => {
      inputRef.current?.focus();
    },
  }), []);

  const resetToIdle = useCallback(() => {
    setState('idle');
    setErrorMessage('');
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
        setState('error');
        setErrorMessage('Please enter a valid URL (e.g. https://example.com)');
        return;
      }

      // Clear any previous error
      setErrorMessage('');
      setState('processing');

      try {
        // Step 1: Scrape the URL
        const scrapeResult = await scrapeUrl(trimmed);
        if (!scrapeResult.success) {
          setState('error');
          setErrorMessage(scrapeResult.error);
          return;
        }

        // Step 2: Geocode the location, passing partialData from scrape
        const geocodeResult = await geocodeLocation({
          location: scrapeResult.location,
          contextualHints: scrapeResult.contextualHints,
          partialData: { title: scrapeResult.title, imageUrl: scrapeResult.imageUrl },
        });

        switch (geocodeResult.status) {
          case 'success': {
            const newPin = addPin({
              title: scrapeResult.title,
              imageUrl: scrapeResult.imageUrl ?? '/placeholder-pin.svg',
              sourceUrl: scrapeResult.sourceUrl,
              latitude: geocodeResult.lat,
              longitude: geocodeResult.lng,
              placeId: geocodeResult.enrichedData.placeId,
              primaryType: geocodeResult.enrichedData.primaryType,
              rating: geocodeResult.enrichedData.rating,
            });
            onPinCreated?.(newPin);
            setState('success');
            setInputValue('');
            setTimeout(() => {
              resetToIdle();
            }, 600);
            break;
          }
          case 'needs_user_input': {
            setPartialData(geocodeResult.partialData);
            setSourceUrl(scrapeResult.sourceUrl);
            setState('needs_input');
            break;
          }
          case 'error': {
            setState('error');
            setErrorMessage(geocodeResult.error);
            break;
          }
        }
      } catch (err) {
        setState('error');
        setErrorMessage(
          err instanceof Error ? err.message : 'Something went wrong'
        );
      }
    },
    [inputValue, addPin, onPinCreated, resetToIdle]
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

  return (
    <div className="fixed top-[max(1.5rem,env(safe-area-inset-top))] left-1/2 -translate-x-1/2 z-[40] flex flex-col items-center w-[90%] max-w-[400px]">
      <motion.form
        onSubmit={handleSubmit}
        layout
        animate={{ width: isFocused ? '100%' : 'min(400px, 100%)' }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className="relative flex items-center w-full rounded-full border border-border bg-surface/80 backdrop-blur-md shadow-xl px-4 py-2"
      >
        {/* Sparkle icon — visible during processing */}
        <AnimatePresence>
          {isProcessing && (
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

        {/* Input field — hidden during processing, replaced by animated text */}
        {isProcessing ? (
          <motion.span
            key="processing-text"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            className="flex-1 text-sm text-accent font-medium select-none"
            role="status"
            aria-live="polite"
          >
            Processing…
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
            aria-invalid={state === 'error'}
            aria-describedby={state === 'error' ? 'magicbar-error' : undefined}
            className="flex-1 bg-transparent outline-none text-sm text-primary placeholder:text-gray-400"
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

      {/* Inline error message */}
      {state === 'error' && errorMessage && (
        <motion.p
          id="magicbar-error"
          role="alert"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-2 text-xs text-red-500 bg-surface/90 backdrop-blur-sm rounded-full px-3 py-1 border border-red-200"
        >
          {errorMessage}
        </motion.p>
      )}

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
