import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { BENEFIT_ICON_STYLES, DEFAULT_BENEFIT_ICON_STYLE, IMAGE_SET_MAX_ASSETS, parseBenefitIconStyle } from "@/lib/products/image-set-kit";
import { imageSetThemeCatalog } from "@/lib/products/image-set-roles";
import { planProductImageSet } from "@/lib/products/image-set-orchestrator";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    themes: imageSetThemeCatalog(),
    maxAssets: IMAGE_SET_MAX_ASSETS,
    benefitIconStyles: BENEFIT_ICON_STYLES,
    defaultBenefitIconStyle: DEFAULT_BENEFIT_ICON_STYLE,
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  const body = await request.json().catch(() => ({})) as { themeKey?: unknown; themeKind?: unknown; benefitIconStyle?: unknown };
  if (body.themeKey !== undefined && typeof body.themeKey !== "string") {
    return NextResponse.json({ error: "themeKey 格式不正確" }, { status: 400 });
  }
  if (body.themeKind !== undefined && body.themeKind !== "PROMO" && body.themeKind !== "SEASONAL") {
    return NextResponse.json({ error: "themeKind 格式不正確" }, { status: 400 });
  }
  // 沒送＝用預設；送了不認得的值就退回 400，不要默默改成預設風格。
  const benefitIconStyle = body.benefitIconStyle === undefined ? undefined : parseBenefitIconStyle(body.benefitIconStyle);
  if (body.benefitIconStyle !== undefined && !benefitIconStyle) {
    return NextResponse.json({ error: "benefitIconStyle 格式不正確" }, { status: 400 });
  }

  const product = await db.product.findUnique({ where: { id: productId }, include: { client: true } });
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const result = await planProductImageSet({
    product,
    client: product.client,
    themeKey: body.themeKey,
    themeKind: body.themeKind,
    benefitIconStyle: benefitIconStyle ?? undefined,
  }, {
    createBatchId: () => `pset_${randomUUID()}`,
    createDraft: (data) => db.productImageSet.create({ data }),
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result.value, { status: 201 });
}
