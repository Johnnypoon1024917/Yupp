import { createServiceRoleClient } from "@/utils/supabase/serviceRole";
import type { UserRoleRow } from "@/types";

export default async function AdminUsersPage() {
  const serviceClient = createServiceRoleClient();

  const { data: users, error } = await serviceClient
    .from("user_roles")
    .select("*")
    .order("created_at", { ascending: false });

  const rows = (users as UserRoleRow[] | null) ?? [];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Users</h1>

      {error && (
        <p className="mb-4 text-sm text-red-600">
          Failed to load users: {error.message}
        </p>
      )}

      {rows.length === 0 && !error ? (
        <p className="py-10 text-center text-gray-500">No users found.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  User ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Role
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Joined
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {rows.map((row) => (
                <tr key={row.user_id}>
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-mono text-gray-700">
                    {row.user_id}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    <RoleBadge role={row.role} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                    {new Date(row.created_at).toLocaleDateString()}
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

function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    admin: "bg-purple-100 text-purple-800",
    support: "bg-blue-100 text-blue-800",
    user: "bg-gray-100 text-gray-700",
  };

  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[role] ?? styles.user}`}
    >
      {role}
    </span>
  );
}
