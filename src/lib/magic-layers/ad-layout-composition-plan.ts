import type { DirectionDecision } from "./ad-layout-art-direction.ts";
import type { AdLayoutDirection, AdLayoutPurpose, NormalizedRect } from "./ad-layout-design-spec.ts";
import { templateForAdvice } from "./ad-layout-templates.ts";

export type CompositionStrategy = "product-hero" | "split-layout" | "scene-integrated";

export type CompositionPlan = {
  strategy: CompositionStrategy;
  variant: string;
  productZone: NormalizedRect;
  copyZone: NormalizedRect;
  benefitZone?: NormalizedRect;
  supportZone?: NormalizedRect;
  alignment: "left" | "center" | "right";
  productPlacement: "floating" | "surface-aligned";
};

export type CompositionPlanInput = {
  canvas: { ratio: string };
  purpose: AdLayoutPurpose;
  hasBenefits?: boolean;
  preferredTextSafeArea?: "left-top" | "right-top" | "left-center" | "bottom";
};

const STRATEGY_BY_DIRECTION: Record<AdLayoutDirection, CompositionStrategy> = {
  "product-focus": "product-hero",
  editorial: "split-layout",
  "scene-led": "scene-integrated",
};

const ALIGNMENT_BY_SAFE_AREA = {
  "left-top": "left",
  "left-center": "left",
  "right-top": "right",
  bottom: "center",
} as const;

const BENEFIT_ZONE: NormalizedRect = { x: 0.07, y: 0.80, w: 0.86, h: 0.13 };
const BENEFIT_GAP = 0.04;

function copy(rect: NormalizedRect): NormalizedRect {
  return { ...rect };
}

function reserveBenefitZone(productZone: NormalizedRect): NormalizedRect {
  const bottom = Math.min(productZone.y + productZone.h, BENEFIT_ZONE.y - BENEFIT_GAP);
  const h = Math.max(0, bottom - productZone.y);
  return { ...productZone, h };
}

export function resolveCompositionPlan(
  input: CompositionPlanInput,
  direction: AdLayoutDirection,
  decision?: DirectionDecision,
): CompositionPlan {
  const template = templateForAdvice(
    direction,
    input.purpose,
    input.canvas.ratio,
    input.preferredTextSafeArea,
    decision?.composition,
  );
  const productZone = input.hasBenefits ? reserveBenefitZone(template.zones.hero) : copy(template.zones.hero);
  return {
    strategy: STRATEGY_BY_DIRECTION[direction],
    variant: template.id,
    productZone,
    copyZone: copy(template.zones.text),
    ...(input.hasBenefits ? { benefitZone: copy(BENEFIT_ZONE) } : {}),
    supportZone: copy(template.zones.support),
    alignment: ALIGNMENT_BY_SAFE_AREA[template.textSafeArea],
    productPlacement: "floating",
  };
}
