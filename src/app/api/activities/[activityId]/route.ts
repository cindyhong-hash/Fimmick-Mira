import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ activityId: string }> }) {
  const { activityId } = await params;
  const activity = await db.activity.findUnique({
    where: { id: activityId },
    include: { generatedLayouts: { orderBy: { layoutType: "asc" } }, client: true },
  });
  if (!activity) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    ...activity,
    referenceImageUrls: JSON.parse(activity.referenceImageUrls),
    client: {
      ...activity.client,
      toneLabels: JSON.parse(activity.client.toneLabels),
      taboos: JSON.parse(activity.client.taboos),
    },
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ activityId: string }> }) {
  const { activityId } = await params;
  const body = await request.json();
  const activity = await db.activity.update({
    where: { id: activityId },
    data: body,
  });
  return NextResponse.json(activity);
}
