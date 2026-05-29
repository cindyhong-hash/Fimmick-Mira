import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const assets = await db.generatedLayout.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      activity: {
        select: { theme: true, clientId: true, client: { select: { name: true } } },
      },
    },
    take: 50,
  });
  return NextResponse.json(assets);
}
