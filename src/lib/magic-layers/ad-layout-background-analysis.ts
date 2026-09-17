import sharp from "sharp";
import type { NormalizedRect } from "./ad-layout-design-spec.ts";

export type BackgroundCell = { luminance: number; variance: number; edge: number };
export type BackgroundAnalysis = { columns: number; rows: number; cells: BackgroundCell[] };
export type BackgroundRectScore = { contrast: number; texture: number; stability: number; safeForCopy: boolean; needsPanel: boolean };

const GRID = 12;

function luminance(r: number, g: number, b: number): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function clamp(value: number): number { return Math.max(0, Math.min(1, value)); }

export async function analyzePreparedBackground(buffer: Buffer): Promise<BackgroundAnalysis> {
  const { data, info } = await sharp(buffer).resize(GRID, GRID, { fit: "fill" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const values = Array.from({ length: GRID * GRID }, (_, index) => luminance(data[index * info.channels]!, data[index * info.channels + 1]!, data[index * info.channels + 2]!));
  const cells = values.map((value, index) => {
    const x = index % GRID;
    const y = Math.floor(index / GRID);
    const neighbours = [x > 0 ? values[index - 1] : undefined, x < GRID - 1 ? values[index + 1] : undefined, y > 0 ? values[index - GRID] : undefined, y < GRID - 1 ? values[index + GRID] : undefined]
      .filter((item): item is number => item !== undefined);
    const mean = neighbours.reduce((sum, item) => sum + item, 0) / neighbours.length;
    const variance = neighbours.reduce((sum, item) => sum + (item - mean) ** 2, 0) / neighbours.length;
    const edge = neighbours.reduce((sum, item) => sum + Math.abs(value - item), 0) / neighbours.length;
    return { luminance: value, variance: clamp(variance * 8), edge: clamp(edge * 2) };
  });
  return { columns: GRID, rows: GRID, cells };
}

export function scoreBackgroundRect(analysis: BackgroundAnalysis, rect: NormalizedRect): BackgroundRectScore {
  const left = Math.max(0, Math.floor(rect.x * analysis.columns));
  const right = Math.min(analysis.columns, Math.ceil((rect.x + rect.w) * analysis.columns));
  const top = Math.max(0, Math.floor(rect.y * analysis.rows));
  const bottom = Math.min(analysis.rows, Math.ceil((rect.y + rect.h) * analysis.rows));
  const cells: BackgroundCell[] = [];
  for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) cells.push(analysis.cells[y * analysis.columns + x]!);
  if (!cells.length) return { contrast: 0, texture: 1, stability: 0, safeForCopy: false, needsPanel: true };
  const texture = cells.reduce((sum, cell) => sum + cell.edge, 0) / cells.length;
  const instability = cells.reduce((sum, cell) => sum + cell.variance, 0) / cells.length;
  const average = cells.reduce((sum, cell) => sum + cell.luminance, 0) / cells.length;
  const contrast = Math.max((average + 0.05) / 0.05, 1.05 / (average + 0.05));
  const stability = clamp(1 - (texture + instability) / 2);
  const safeForCopy = stability >= 0.72 && contrast >= 4.5;
  return { contrast, texture, stability, safeForCopy, needsPanel: !safeForCopy };
}
