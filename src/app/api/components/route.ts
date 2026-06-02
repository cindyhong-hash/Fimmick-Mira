import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId");

  const components = await db.styleComponent.findMany({
    where: clientId ? { clientId } : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json(
    components.map((c) => ({ ...c, data: JSON.parse(c.data) }))
  );
}
