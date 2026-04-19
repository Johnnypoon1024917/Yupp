'use client';

import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import type { Pin } from '@/types';

export type MagicBarState = 'idle' | 'processing' | 'error' | 'success';

export interface MagicBarProps {
  onPinCreated?: (pin: Pin) => void;
  onSubmit?: (url: string) => Promise<void>;
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

export default function MagicBar({ onSubmit }: MagicBarProps) {
  const [state, setState] = useState<MagicBarState>('idle');
  const [inputValue, setInputValue] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const resetToIdle = useCallback(() => {
    setState('idle');
    setErrorMessage('');
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
        if (onSubmit) {
          await onSubmit(trimmed);
        }
        // Success — clear input and briefly show success state
        setState('success');
        setInputValue('');
        setTimeout(() => {
          resetToIdle();
        }, 600);
      } catch (err) {
        setState('error');
        setErrorMessage(
          err instanceof Error ? err.message : 'Something went wrong'
        );
      }
    },
    [inputValue, onSubmit, resetToIdle]
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

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[40] flex flex-col items-center">
      <motion.form
        onSubmit={handleSubmit}
        layout
        animate={{ width: isFocused ? 480 : 400 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className="relative flex items-center w-full max-w-[90vw] rounded-full border border-border bg-surface/80 backdrop-blur-md shadow-sm px-4 py-2"
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
    </div>
  );
}
