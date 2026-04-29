'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const CONSENT_KEY = 'analytics_consent';

export default function ConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(CONSENT_KEY);
    if (!consent) setVisible(true);
  }, []);

  if (!visible) return null;

  const handleAccept = () => {
    localStorage.setItem(CONSENT_KEY, 'granted');
    setVisible(false);
    window.dispatchEvent(new Event('consent-granted'));
  };

  const handleDecline = () => {
    localStorage.setItem(CONSENT_KEY, 'denied');
    setVisible(false);
  };

  return (
    <div className="fixed bottom-20 left-4 right-4 z-[60] rounded-card bg-surface border border-border shadow-elev-2 p-4"
         role="dialog" aria-label="Analytics consent">
      <p className="text-caption text-ink-2 mb-3">
        We use analytics to improve Yupp.{' '}
        <Link href="/privacy" className="underline text-brand">Privacy Policy</Link>
        {' · '}
        <Link href="/terms" className="underline text-brand">Terms</Link>
      </p>
      <div className="flex gap-2">
        <button onClick={handleAccept}
                className="flex-1 rounded-control bg-brand text-white text-caption py-2 font-medium">
          Accept
        </button>
        <button onClick={handleDecline}
                className="flex-1 rounded-control bg-surface-sunken text-ink-2 text-caption py-2 font-medium">
          Decline
        </button>
      </div>
    </div>
  );
}
