import { createClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/serviceRole";
import type { ActivityLog } from "@/types";

async function fetchKPIs() {
  const serviceClient = createServiceRoleClient();

  const [usersResult, pinsResult, itinerariesResult] = await Promise.all([
    serviceClient
      .from("user_roles")
      .select("*", { count: "exact", head: true }),
    serviceClient
      .from("pins")
      .select("*", { count: "exact", head: true }),
    serviceClient
      .from("itineraries")
      .select("*", { count: "exact", head: true }),
  ]);

  return {
    totalUsers: usersResult.count ?? 0,
    totalPins: pinsResult.count ?? 0,
    totalTrips: itinerariesResult.count ?? 0,
  };
}

export default async function AdminDashboard() {
  const supabase = await createClient();

  const [kpis, { data: logs }] = await Promise.all([
    fetchKPIs(),
    supabase
      .from("activity_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const entries = (logs as ActivityLog[] | null) ?? [];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Dashboard</h1>

      {/* KPI Cards */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KPICard label="Total Users" value={kpis.totalUsers} />
        <KPICard label="Total Pins Saved" value={kpis.totalPins} />
        <KPICard label="Total Trips Planned" value={kpis.totalTrips} />
      </div>

      {/* Activity Logs */}
      <h2 className="mb-4 text-xl font-semibold text-gray-900">
        Activity Logs
      </h2>

      {entries.length === 0 ? (
        <p className="py-10 text-center text-gray-500">
          No activity recorded yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Time
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  User ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Action
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Pin Title
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {entries.map((log) => (
                <tr key={log.id}>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                    {log.user_id ?? "Anonymous"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                    {log.action}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                    {(log.metadata?.title as string) ?? "—"}
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

function KPICard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-3xl font-bold text-gray-900">
        {value.toLocaleString()}
      </p>
    </div>
  );
}
