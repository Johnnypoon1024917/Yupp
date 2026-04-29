'use client';

import { useEffect } from 'react';
import { trackEvent } from '@/components/AnalyticsProvider';
import { EVENTS } from '@/utils/analytics';

export default function LandingScrollTracker() {
  useEffect(() => {
    // Track CTA clicks via event delegation
    const handleClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('a[href="/app"]');
      if (target) {
        const section = target.closest('section');
        trackEvent(EVENTS.LANDING_CTA_CLICKED, {
          section: section?.dataset.section || 'unknown',
        });
      }
    };
    document.addEventListener('click', handleClick);

    // Track scroll depth with IntersectionObserver
    const sections = document.querySelectorAll('section[data-section]');
    const seen = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const name = (entry.target as HTMLElement).dataset.section;
            if (name && !seen.has(name)) {
              seen.add(name);
              trackEvent(EVENTS.LANDING_SCROLL_DEPTH, { section: name });
            }
          }
        }
      },
      { threshold: 0.3 },
    );

    sections.forEach((s) => observer.observe(s));

    return () => {
      document.removeEventListener('click', handleClick);
      observer.disconnect();
    };
  }, []);

  return null;
}
