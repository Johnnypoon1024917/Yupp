import { redirect } from 'next/navigation';

export default async function TripRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/app/trip/${id}`);
}
