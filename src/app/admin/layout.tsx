import Link from "next/link";

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-64 shrink-0 border-r border-gray-200 bg-gray-50 p-6">
        <h2 className="mb-6 text-lg font-semibold text-gray-900">Admin</h2>
        <nav className="flex flex-col gap-2">
          <Link
            href="/admin"
            className="rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
          >
            Dashboard
          </Link>
          <Link
            href="/admin/users"
            className="rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
          >
            Users
          </Link>
          <Link
            href="/admin/pins"
            className="rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
          >
            Global Pins
          </Link>
        </nav>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
