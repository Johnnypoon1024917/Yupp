import type { Metadata } from 'next';
import Link from 'next/link';
import { MapPin, Sparkles, Calendar } from 'lucide-react';
import LandingScrollTracker from '@/components/LandingScrollTracker';

export const metadata: Metadata = {
  title: 'YUPP | Turn Travel Inspo Into Real Plans',
  description:
    'Paste a link from Instagram, TikTok, or Xiaohongshu. Yupp extracts the place, pins it on your map, and helps you plan the trip.',
  openGraph: {
    title: 'YUPP | Turn Travel Inspo Into Real Plans',
    description:
      'Paste a link from Instagram, TikTok, or Xiaohongshu. Yupp extracts the place, pins it on your map, and helps you plan the trip.',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'YUPP | Turn Travel Inspo Into Real Plans',
    description:
      'Paste a link from Instagram, TikTok, or Xiaohongshu.',
    images: ['/og-image.png'],
  },
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-surface text-ink-1">
      {/* Hero */}
      <section data-section="hero" className="px-6 pt-16 pb-20 text-center max-w-3xl mx-auto">
        <h1 className="text-display mb-4">Turn travel inspo into real plans</h1>
        <p className="text-body text-ink-2 mb-8 max-w-lg mx-auto">
          Paste a link from Instagram, TikTok, Xiaohongshu, or Douyin. Yupp
          extracts the place, pins it on your map, and helps you plan the trip.
        </p>
        <Link
          href="/app"
          className="inline-block rounded-pill bg-brand text-white px-8 py-3 text-headline font-semibold shadow-elev-1 hover:shadow-elev-2 transition-shadow"
        >
          Start Pinning — It's Free
        </Link>
      </section>

      {/* Features */}
      <section data-section="features" className="px-6 py-16 bg-surface-raised">
        <div className="max-w-4xl mx-auto grid md:grid-cols-3 gap-8">
          {[
            {
              icon: Sparkles,
              title: 'AI-Powered Extraction',
              desc: 'Paste any social media link. Our AI finds the place name, photos, and location.',
            },
            {
              icon: MapPin,
              title: 'Visual Pin Board',
              desc: 'See all your saved places on an interactive map. Organised by category automatically.',
            },
            {
              icon: Calendar,
              title: 'Trip Planner',
              desc: 'Drag pins into a day-by-day itinerary. Share your trip with friends.',
            },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-card bg-brand-soft text-brand mb-4">
                <Icon size={24} />
              </div>
              <h3 className="text-headline mb-2">{title}</h3>
              <p className="text-body text-ink-2">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section data-section="how-it-works" className="px-6 py-16">
        <h2 className="text-title text-center mb-12">How It Works</h2>
        <div className="max-w-3xl mx-auto grid md:grid-cols-3 gap-8">
          {[
            {
              step: '1',
              title: 'Paste a link',
              desc: 'Copy a URL from Instagram, TikTok, Xiaohongshu, or Douyin and paste it into Yupp.',
            },
            {
              step: '2',
              title: 'Pin it to the map',
              desc: 'Yupp extracts the place, geocodes it, and drops a pin on your personal map.',
            },
            {
              step: '3',
              title: 'Plan your trip',
              desc: 'Drag your pins into a day-by-day itinerary and share it with travel buddies.',
            },
          ].map(({ step, title, desc }) => (
            <div key={step} className="text-center">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-pill bg-brand text-white text-headline font-bold mb-4">
                {step}
              </div>
              <h3 className="text-headline mb-2">{title}</h3>
              <p className="text-body text-ink-2">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section data-section="cta" className="px-6 py-20 text-center bg-surface-raised">
        <h2 className="text-title mb-4">Ready to plan your next trip?</h2>
        <Link
          href="/app"
          className="inline-block rounded-pill bg-brand text-white px-8 py-3 text-headline font-semibold shadow-elev-1 hover:shadow-elev-2 transition-shadow"
        >
          Get Started Free
        </Link>
      </section>

      {/* Footer */}
      <footer className="px-6 py-8 text-center text-caption text-ink-3 border-t border-border">
        <div className="flex justify-center gap-4">
          <Link href="/privacy" className="hover:text-ink-2">Privacy</Link>
          <Link href="/terms" className="hover:text-ink-2">Terms</Link>
          <Link href="/app" className="hover:text-ink-2">Open App</Link>
        </div>
        <p className="mt-2">© {new Date().getFullYear()} Yupp</p>
      </footer>

      {/* Client-side scroll tracker for analytics */}
      <LandingScrollTracker />
    </div>
  );
}
