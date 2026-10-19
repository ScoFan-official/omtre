import type { OmtreTaskRecord } from "./schema.js";

/**
 * Coarse-grained Omtre task phase derived from task status.
 *
 * Phase is a projection of {@link OmtreTaskRecord.status} only. There is
 * no separate `current_phase` field stored on disk — `inferTaskPhase`
 * exists so consumers can render the workflow phase without depending on
 * `.omtre/workflow.md` parsing.
 *
 * Mapping:
 *
 *   status              | phase
 *   --------------------|-----------
 *   planning            | plan
 *   in_progress         | implement
 *   review              | review
 *   completed | done    | completed
 *   <anything else>     | unknown
 */
export type OmtreTaskPhase =
  | "plan"
  | "implement"
  | "review"
  | "completed"
  | "unknown";

/**
 * Infer the phase of a task from either its parsed record or its raw
 * status string. Accepts a record so callers that already have one don't
 * need to re-pluck `status` first.
 */
export function inferTaskPhase(
  recordOrStatus: OmtreTaskRecord | string | null | undefined,
): OmtreTaskPhase {
  const status =
    typeof recordOrStatus === "string"
      ? recordOrStatus
      : recordOrStatus?.status;
  switch (status) {
    case "planning":
      return "plan";
    case "in_progress":
      return "implement";
    case "review":
      return "review";
    case "completed":
    case "done":
      return "completed";
    default:
      return "unknown";
  }
}
