import ConsentBanner from '@/components/ConsentBanner';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <ConsentBanner />
    </>
  );
}
