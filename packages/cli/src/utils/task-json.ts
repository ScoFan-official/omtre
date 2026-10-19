/**
 * Canonical task.json shape — single source of truth shared by all TS
 * writers. The canonical types and factory now live in the
 * `@omtre/core` task API; this module re-exports them under
 * the legacy `TaskJson` / `emptyTaskJson` names for CLI call sites.
 *
 * New code should prefer `OmtreTaskRecord` / `emptyTaskRecord` from
 * `@omtre/core/task` directly.
 */

import { emptyTaskRecord, type OmtreTaskRecord } from "@omtre/core/task";

export type TaskJson = OmtreTaskRecord;

export const emptyTaskJson = emptyTaskRecord;
