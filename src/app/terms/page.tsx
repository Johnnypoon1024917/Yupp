import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service | YUPP',
  description: 'Terms of service for using the Yupp travel planning app.',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-surface text-ink-1">
      <div className="max-w-2xl mx-auto px-6 py-16">
        <nav className="mb-12 flex gap-4 text-caption text-ink-3">
          <Link href="/" className="hover:text-ink-2">← Home</Link>
          <Link href="/app" className="hover:text-ink-2">Open App</Link>
        </nav>

        <h1 className="text-title mb-8">Terms of Service</h1>
        <p className="text-body text-ink-2 mb-10">
          Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </p>

        <section className="mb-10">
          <h2 className="text-headline mb-3">Acceptable Use</h2>
          <p className="text-body text-ink-2 mb-3">
            Yupp is a travel planning tool. By using the service, you agree to:
          </p>
          <ul className="list-disc pl-5 text-body text-ink-2 space-y-1">
            <li>Use Yupp only for lawful, personal travel planning purposes</li>
            <li>Not attempt to scrape, reverse-engineer, or overload the service</li>
            <li>Not upload or share content that is harmful, abusive, or violates others' rights</li>
            <li>Not use automated tools to access the service beyond normal app usage</li>
          </ul>
          <p className="text-body text-ink-2 mt-3">
            We reserve the right to suspend accounts that violate these terms.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-headline mb-3">Intellectual Property</h2>
          <p className="text-body text-ink-2 mb-3">
            The Yupp name, logo, and application code are the property of Yupp and its creators.
            Content you create within Yupp (pins, itineraries, trip plans) remains yours.
          </p>
          <p className="text-body text-ink-2">
            Place data extracted from third-party social media links is sourced from publicly
            available content. Yupp does not claim ownership of third-party content and uses
            it solely to help you organise your travel plans.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-headline mb-3">Limitation of Liability</h2>
          <p className="text-body text-ink-2 mb-3">
            Yupp is provided "as is" without warranties of any kind. We do our best to keep
            the service running smoothly, but we cannot guarantee:
          </p>
          <ul className="list-disc pl-5 text-body text-ink-2 space-y-1">
            <li>Uninterrupted or error-free service availability</li>
            <li>Accuracy of place data extracted from social media links</li>
            <li>Accuracy of geocoding or map pin placement</li>
            <li>Preservation of data in the event of service discontinuation</li>
          </ul>
          <p className="text-body text-ink-2 mt-3">
            Yupp shall not be liable for any indirect, incidental, or consequential damages
            arising from your use of the service.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-headline mb-3">Governing Law</h2>
          <p className="text-body text-ink-2">
            These terms are governed by and construed in accordance with applicable law.
            Any disputes arising from the use of Yupp shall be resolved through good-faith
            negotiation. If a resolution cannot be reached, disputes shall be submitted to
            the courts of the jurisdiction in which Yupp operates.
          </p>
        </section>

        <footer className="pt-8 border-t border-border text-caption text-ink-3 flex gap-4">
          <Link href="/" className="hover:text-ink-2">Home</Link>
          <Link href="/privacy" className="hover:text-ink-2">Privacy Policy</Link>
          <Link href="/app" className="hover:text-ink-2">Open App</Link>
        </footer>
      </div>
    </div>
  );
}
