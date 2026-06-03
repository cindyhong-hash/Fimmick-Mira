import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId");
  const previewUrl = searchParams.get("previewUrl");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {};
  if (clientId) where.clientId = clientId;
  if (previewUrl) where.previewUrl = previewUrl;

  const components = await db.styleComponent.findMany({
    where: Object.keys(where).length ? where : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json(
    components.map((c) => ({ ...c, data: JSON.parse(c.data) }))
  );
}

export async function POST(request: Request) {
  const body = await request.json();
  const { name, type, clientId, data, aiPromptText, previewUrl } = body;

  if (!name || !type) {
    return NextResponse.json({ error: "name and type are required" }, { status: 400 });
  }

  const component = await db.styleComponent.create({
    data: {
      name,
      type,
      clientId: clientId ?? null,
      data: JSON.stringify(data ?? {}),
      aiPromptText: aiPromptText ?? "",
      previewUrl: previewUrl ?? null,
      sourceLayoutId: "manual",
    },
  });

  return NextResponse.json({ ...component, data: JSON.parse(component.data) });
}
