import type { AdLayoutDesignSpec } from "./ad-layout-design-spec.ts";
import { validateAdLayoutSpec, type AdLayoutQualityCheck } from "./ad-layout-quality.ts";

export type AdLayoutEvaluation = { score: number; checks: AdLayoutQualityCheck[]; hardFailures: string[] };

const HARD_FAILURES = new Set(["product-footprint", "product-copy-overlap", "product-benefit-overlap", "support-benefit-conflict"]);

export function evaluateAdLayout(spec: AdLayoutDesignSpec): AdLayoutEvaluation {
  const checks = validateAdLayoutSpec(spec);
  const failed = checks.filter((check) => !check.passed);
  return { score: Math.max(0, 100 - failed.length * 15), checks, hardFailures: failed.filter((check) => HARD_FAILURES.has(check.id)).map((check) => check.id) };
}

export function repairAdLayoutSpec(spec: AdLayoutDesignSpec, evaluation = evaluateAdLayout(spec)): AdLayoutDesignSpec {
  if (!evaluation.hardFailures.includes("support-benefit-conflict")) return spec;
  const reason = "三條賣點已足夠傳達訊息，已移除競爭性的輔助視覺";
  return { ...spec, assets: { ...spec.assets, support: undefined }, rationale: [...spec.rationale, reason], polishTreatment: { ...spec.polishTreatment, reasons: [...spec.polishTreatment.reasons, reason] } };
}
