import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/library/gallery?clientId=...
 * The brand image gallery for the merged 風格組件 tab — a union of:
 *   • "uploaded"  — analyzed images (StyleComponent.previewUrl), grouped by url
 *   • "generated" — library-generated images (LibraryImage rows)
 * Sorted newest first.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId");

  // ── Uploaded analyzed images (components that carry a previewUrl) ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const compWhere: Record<string, any> = { previewUrl: { not: null } };
  if (clientId) compWhere.clientId = clientId;

  const comps = await db.styleComponent.findMany({
    where: compWhere,
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const uploadedMap = new Map<
    string,
    { imageUrl: string; types: string[]; componentIds: string[]; createdAt: Date }
  >();
  for (const c of comps) {
    const u = c.previewUrl!;
    const entry =
      uploadedMap.get(u) ?? { imageUrl: u, types: [], componentIds: [], createdAt: c.createdAt };
    if (!entry.types.includes(c.type)) entry.types.push(c.type);
    entry.componentIds.push(c.id);
    if (c.createdAt > entry.createdAt) entry.createdAt = c.createdAt;
    uploadedMap.set(u, entry);
  }

  // ── Generated library images ──
  const gens = await db.libraryImage.findMany({
    where: clientId ? { clientId } : undefined,
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const items = [
    ...[...uploadedMap.values()].map((e) => ({
      kind: "uploaded" as const,
      imageUrl: e.imageUrl,
      types: e.types,
      componentIds: e.componentIds,
      createdAt: e.createdAt,
    })),
    ...gens.map((g) => ({
      kind: "generated" as const,
      imageUrl: g.imageUrl,
      libraryImageId: g.id,
      copyText: g.copyText,
      subject: g.subject,
      paramsJson: g.paramsJson,
      createdAt: g.createdAt,
    })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return NextResponse.json(items);
}
