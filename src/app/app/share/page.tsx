'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { extractSupportedUrl } from '@/utils/urlParsing';

function ShareRedirect() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const urlParam = searchParams.get('url') ?? '';
    const textParam = searchParams.get('text') ?? '';

    const extracted = extractSupportedUrl(urlParam) ?? extractSupportedUrl(textParam);

    if (extracted) {
      router.replace(`/app?autoPaste=${encodeURIComponent(extracted)}`);
    } else {
      router.replace('/app');
    }
  }, [searchParams, router]);

  return null;
}

export default function SharePage() {
  return (
    <Suspense fallback={null}>
      <ShareRedirect />
    </Suspense>
  );
}
