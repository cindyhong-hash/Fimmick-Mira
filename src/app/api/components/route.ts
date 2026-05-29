import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const components = await db.styleComponent.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json(
    components.map((c) => ({ ...c, data: JSON.parse(c.data) }))
  );
}
