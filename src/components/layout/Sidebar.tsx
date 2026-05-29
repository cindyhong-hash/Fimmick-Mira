"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { FolderOpen, Plus, Library } from "lucide-react";
import { Button } from "@/components/ui/button";

type Client = { id: string; name: string; _count: { activities: number } };

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);

  useEffect(() => {
    fetch("/api/clients")
      .then((r) => r.json())
      .then(setClients);
  }, [pathname]);

  return (
    <aside className="w-60 min-h-screen border-r bg-gray-50 flex flex-col p-3 gap-1 shrink-0">
      <div className="flex items-center justify-between px-2 py-1 mb-2">
        <span className="font-semibold text-sm text-gray-700">客戶</span>
        <Link href="/clients/new">
          <Button variant="ghost" size="icon" className="h-6 w-6">
            <Plus className="h-4 w-4" />
          </Button>
        </Link>
      </div>

      {clients.length === 0 && (
        <div className="px-2 text-xs text-gray-400">尚無客戶，點 + 新增</div>
      )}

      {clients.map((client) => (
        <Link key={client.id} href={`/clients/${client.id}`} className="block">
          <div
            className={`flex items-center gap-2 px-2 py-2 rounded-md text-sm cursor-pointer hover:bg-gray-100 ${
              pathname.startsWith(`/clients/${client.id}`) ? "bg-gray-200 font-medium" : ""
            }`}
          >
            <FolderOpen className="h-4 w-4 text-gray-500 shrink-0" />
            <span className="truncate">{client.name}</span>
            <span className="ml-auto text-xs text-gray-400">{client._count.activities}</span>
          </div>
        </Link>
      ))}

      <div className="mt-auto">
        <Link href="/library">
          <div
            className={`flex items-center gap-2 px-2 py-2 rounded-md text-sm cursor-pointer hover:bg-gray-100 ${
              pathname === "/library" ? "bg-gray-200 font-medium" : ""
            }`}
          >
            <Library className="h-4 w-4 text-gray-500" />
            <span>素材庫</span>
          </div>
        </Link>
      </div>
    </aside>
  );
}
