import { createClient } from "@/utils/supabase/server";
import type { ActivityLog } from "@/types";

export default async function AdminDashboard() {
  const supabase = await createClient();
  const { data: logs } = await supabase
    .from("activity_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  const entries = (logs as ActivityLog[] | null) ?? [];

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-500">
        <p className="text-lg">No activity recorded yet.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">
        Activity Logs
      </h1>
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
    </div>
  );
}
