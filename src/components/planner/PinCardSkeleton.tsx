export default function PinCardSkeleton(): JSX.Element {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-white border border-gray-200 p-2 min-w-0">
      <div className="w-16 h-16 rounded-lg bg-neutral-100 animate-pulse shrink-0" />
      <div className="flex-1 h-4 bg-neutral-100 animate-pulse rounded" />
    </div>
  );
}
