import { redirect } from 'next/navigation';

export default async function ShareRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  const qs = new URLSearchParams(params).toString();
  redirect(`/app/share${qs ? `?${qs}` : ''}`);
}
