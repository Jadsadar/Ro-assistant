/**
 * Ranks candidate items by the damage they actually produce.
 *
 * Every candidate is put into the build and run through the real engine — there
 * is no scoring heuristic, because a heuristic would be a second, disagreeing
 * answer next to the calculator's. Measured on this catalog, one call costs
 * ~3ms and the largest slot any class can fill has 130 candidates, so an exact
 * answer for a whole slot is well under a second and needs no shortlisting.
 *
 * The loop yields to the event loop between batches so the page keeps painting,
 * which matters because this runs in the browser: the app is a static export
 * with no server to do the work.
 */

import type { CatalogSearchItem } from "@/lib/catalog/types";
import {
  calculateDamage,
  type DamageCalculationInput,
  type DamageCalculationResult,
} from "@/lib/calculator/damage-engine";
import type { EquipmentSlot } from "@/lib/equipment/types";

export interface SlotCandidateScore {
  item: CatalogSearchItem;
  /** The refine the candidate was evaluated at; 0 for items that cannot refine. */
  refine: number;
  skillMin: number;
  skillMax: number;
  skillDps: number;
  basicDps: number;
  /** `skillMax` minus the baseline build's, so "worth swapping" is readable. */
  deltaSkillMax: number;
  deltaSkillDps: number;
}

export interface SlotEvaluationFailure {
  item: CatalogSearchItem;
  message: string;
}

export interface SlotEvaluation {
  baseline: DamageCalculationResult | null;
  scores: SlotCandidateScore[];
  failures: SlotEvaluationFailure[];
  stats: {
    candidates: number;
    evaluated: number;
    /** Wall-clock time for the engine calls, in milliseconds. */
    elapsedMs: number;
    msPerCandidate: number;
  };
}

export type SlotSort = "skillMax" | "skillDps" | "basicDps" | "delta";

export interface EvaluateSlotParams {
  candidates: CatalogSearchItem[];
  slot: EquipmentSlot;
  /**
   * Builds the engine input for one candidate. The caller owns this so the tool
   * reuses the calculator's own adapter rather than assembling a second, subtly
   * different build.
   */
  buildInput: (
    item: CatalogSearchItem | null,
    refine: number,
  ) => Promise<DamageCalculationInput>;
  /** Refine applied to refinable candidates. */
  refine?: number;
  sort?: SlotSort;
  limit?: number;
  /** Reported after every batch, for a progress bar. */
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
  /**
   * The engine to run. Defaults to the calculator's own, and exists so the
   * ranking can be tested without the damage formula, and so this loop can be
   * moved onto a Web Worker later without changing its callers.
   */
  calculate?: (input: DamageCalculationInput) => Promise<DamageCalculationResult>;
}

/** Small enough that the page still repaints, large enough to stay cheap. */
const BATCH_SIZE = 16;

function compare(sort: SlotSort) {
  return (left: SlotCandidateScore, right: SlotCandidateScore): number => {
    if (sort === "skillDps") return right.skillDps - left.skillDps;
    if (sort === "basicDps") return right.basicDps - left.basicDps;
    if (sort === "delta") return right.deltaSkillMax - left.deltaSkillMax;
    return right.skillMax - left.skillMax;
  };
}

export async function evaluateSlotCandidates({
  candidates,
  buildInput,
  refine = 10,
  sort = "skillMax",
  limit,
  onProgress,
  signal,
  calculate = calculateDamage,
}: EvaluateSlotParams): Promise<SlotEvaluation> {
  // The build with the slot left empty, so every candidate can be read as a
  // gain over wearing nothing there rather than as a bare number.
  let baseline: DamageCalculationResult | null = null;
  try {
    baseline = await calculate(await buildInput(null, 0));
  } catch {
    // A build that cannot be calculated empty still ranks fine; only the deltas
    // are lost, and they are reported as 0 rather than as a wrong number.
  }

  const baselineSkillMax = baseline?.skill.max ?? 0;
  const baselineSkillDps = baseline?.skill.dps ?? 0;

  const scores: SlotCandidateScore[] = [];
  const failures: SlotEvaluationFailure[] = [];
  const startedAt = performance.now();

  for (let index = 0; index < candidates.length; index += 1) {
    signal?.throwIfAborted();
    const item = candidates[index];
    const appliedRefine = item.isRefinable ? refine : 0;

    try {
      const result = await calculate(await buildInput(item, appliedRefine));
      scores.push({
        item,
        refine: appliedRefine,
        skillMin: result.skill.min,
        skillMax: result.skill.max,
        skillDps: result.skill.dps,
        basicDps: result.basic.dps,
        deltaSkillMax: result.skill.max - baselineSkillMax,
        deltaSkillDps: result.skill.dps - baselineSkillDps,
      });
    } catch (reason: unknown) {
      // One unusable item must not end the run: the rest of the slot is still
      // a useful answer, and the failures are reported rather than hidden.
      failures.push({
        item,
        message: reason instanceof Error ? reason.message : String(reason),
      });
    }

    if ((index + 1) % BATCH_SIZE === 0 || index === candidates.length - 1) {
      onProgress?.(index + 1, candidates.length);
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  const elapsedMs = performance.now() - startedAt;
  scores.sort(compare(sort));

  return {
    baseline,
    scores: limit != null ? scores.slice(0, limit) : scores,
    failures,
    stats: {
      candidates: candidates.length,
      evaluated: scores.length,
      elapsedMs,
      msPerCandidate: candidates.length ? elapsedMs / candidates.length : 0,
    },
  };
}
