import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Never statically cache this handler — component data changes on every edit/save/delete.
export const dynamic = "force-dynamic";

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

  // Upsert: if a component of this type already exists for the same image
  // (previewUrl), update it in place + bump to top instead of creating a duplicate.
  if (previewUrl) {
    const existing = await db.styleComponent.findFirst({
      where: { previewUrl, type, clientId: clientId ?? null },
    });
    if (existing) {
      const updated = await db.styleComponent.update({
        where: { id: existing.id },
        data: {
          name,
          data: JSON.stringify(data ?? {}),
          aiPromptText: aiPromptText ?? "",
          createdAt: new Date(), // bump to top
        },
      });
      return NextResponse.json({ ...updated, data: JSON.parse(updated.data) });
    }
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
