import { createServiceRoleClient } from "@/utils/supabase/serviceRole";

interface PinRow {
  id: string;
  title: string;
  address: string | null;
  latitude: number;
  longitude: number;
  source_url: string;
  created_at: string;
}

export default async function AdminPinsPage() {
  const serviceClient = createServiceRoleClient();

  const { data: pins, error } = await serviceClient
    .from("pins")
    .select("id, title, address, latitude, longitude, source_url, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  const rows = (pins as PinRow[] | null) ?? [];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">
        Global Pins Directory
      </h1>

      {error && (
        <p className="mb-4 text-sm text-red-600">
          Failed to load pins: {error.message}
        </p>
      )}

      {rows.length === 0 && !error ? (
        <p className="py-10 text-center text-gray-500">No pins found.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Pin Title
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Location
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Source URL
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Date Added
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {rows.map((pin) => (
                <tr key={pin.id}>
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                    {pin.title}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                    {pin.address ?? `${pin.latitude.toFixed(4)}, ${pin.longitude.toFixed(4)}`}
                  </td>
                  <td className="max-w-xs truncate px-4 py-3 text-sm">
                    <a
                      href={pin.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {pin.source_url}
                    </a>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                    {new Date(pin.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
