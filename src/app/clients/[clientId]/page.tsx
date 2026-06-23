"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Trash2 } from "lucide-react";
import { BrandWorkspaceHeader } from "@/components/layout/BrandWorkspaceHeader";
import { BrandMemoryCards } from "@/components/clients/BrandMemoryCards";

type Activity = { id: string; theme: string; focusPoint: string; status: string; createdAt: string };
type Client = { id: string; name: string; activities: Activity[] };

const STATUS_LABEL: Record<string, string> = { PENDING: "待生成", GENERATING: "生成中", DONE: "已完成" };
const STATUS_VARIANT: Record<string, "secondary" | "outline" | "default"> = {
  PENDING: "secondary",
  GENERATING: "outline",
  DONE: "default",
};

export default function ClientFolderPage({ params }: { params: Promise<{ clientId: string }> }) {
  const [clientId, setClientId] = useState<string>("");
  const [client, setClient] = useState<Client | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    params.then(({ clientId }) => {
      setClientId(clientId);
      fetch(`/api/clients/${clientId}`).then((r) => r.json()).then(setClient);
    });
  }, [params]);

  const handleDelete = async (e: React.MouseEvent, activityId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("確定要刪除這個活動？此操作無法復原。")) return;
    setDeletingId(activityId);
    await fetch(`/api/activities/${activityId}`, { method: "DELETE" });
    setClient((prev) =>
      prev ? { ...prev, activities: prev.activities.filter((a) => a.id !== activityId) } : prev
    );
    setDeletingId(null);
  };

  if (!client) return <div className="text-gray-400">載入中...</div>;

  return (
    <div>
      <BrandWorkspaceHeader clientId={clientId} activeTab="activities" />

      <BrandMemoryCards clientId={clientId} />

      {client.activities.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          還沒有活動，點右上角「新增活動」開始
        </div>
      ) : (
        <div className="space-y-2">
          {client.activities.map((act) => (
            <Link key={act.id} href={`/clients/${clientId}/activities/${act.id}`}>
              <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
                <div>
                  <div className="font-medium">{act.theme}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{act.focusPoint}</div>
                  <div className="text-xs text-gray-300 mt-0.5">
                    {new Date(act.createdAt).toLocaleDateString("zh-TW")}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={STATUS_VARIANT[act.status]}>{STATUS_LABEL[act.status]}</Badge>
                  <button
                    onClick={(e) => handleDelete(e, act.id)}
                    disabled={deletingId === act.id}
                    className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors disabled:opacity-40"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
