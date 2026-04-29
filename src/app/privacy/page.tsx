import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy | YUPP',
  description: 'Learn how Yupp collects, uses, and protects your data.',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-surface text-ink-1">
      <div className="max-w-2xl mx-auto px-6 py-16">
        <nav className="mb-12 flex gap-4 text-caption text-ink-3">
          <Link href="/" className="hover:text-ink-2">← Home</Link>
          <Link href="/app" className="hover:text-ink-2">Open App</Link>
        </nav>

        <h1 className="text-title mb-8">Privacy Policy</h1>
        <p className="text-body text-ink-2 mb-10">
          Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </p>

        <section className="mb-10">
          <h2 className="text-headline mb-3">Data Collected</h2>
          <p className="text-body text-ink-2 mb-3">
            Yupp collects minimal data to provide and improve the service. This includes:
          </p>
          <ul className="list-disc pl-5 text-body text-ink-2 space-y-1">
            <li>Travel pins you create (place names, locations, and source URLs)</li>
            <li>Itineraries and trip plans you build</li>
            <li>Basic usage analytics (page views, feature usage) when you consent</li>
            <li>Account information if you sign in (email, display name)</li>
            <li>Device type and whether you use the app as a PWA</li>
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="text-headline mb-3">How Data Is Used</h2>
          <p className="text-body text-ink-2 mb-3">
            We use your data to:
          </p>
          <ul className="list-disc pl-5 text-body text-ink-2 space-y-1">
            <li>Save and sync your travel pins and itineraries across devices</li>
            <li>Extract place information from social media links you paste</li>
            <li>Understand how people use Yupp so we can improve the product</li>
            <li>Provide shared trip links when you choose to share a trip</li>
          </ul>
          <p className="text-body text-ink-2 mt-3">
            We do not sell your personal data to third parties.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-headline mb-3">Third-Party Services</h2>
          <p className="text-body text-ink-2 mb-3">
            Yupp uses <strong>PostHog</strong> for product analytics. PostHog helps us understand
            which features are used and where users encounter issues. Analytics data is only
            collected after you provide explicit consent through the in-app consent banner.
          </p>
          <p className="text-body text-ink-2">
            We disable autocapture, session recording, and heatmaps in PostHog. Only specific,
            named events (such as pin creation and trip planning actions) are tracked.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-headline mb-3">Data Retention</h2>
          <p className="text-body text-ink-2">
            Your travel pins and itineraries are retained as long as your account is active.
            Analytics data is retained for up to 12 months and then automatically deleted.
            You can request deletion of your data at any time by contacting us.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-headline mb-3">User Rights</h2>
          <p className="text-body text-ink-2 mb-3">
            You have the right to:
          </p>
          <ul className="list-disc pl-5 text-body text-ink-2 space-y-1">
            <li>Decline analytics tracking via the consent banner</li>
            <li>Request a copy of your personal data</li>
            <li>Request deletion of your account and associated data</li>
            <li>Withdraw consent for analytics at any time by clearing your browser storage</li>
          </ul>
        </section>

        <footer className="pt-8 border-t border-border text-caption text-ink-3 flex gap-4">
          <Link href="/" className="hover:text-ink-2">Home</Link>
          <Link href="/terms" className="hover:text-ink-2">Terms of Service</Link>
          <Link href="/app" className="hover:text-ink-2">Open App</Link>
        </footer>
      </div>
    </div>
  );
}
