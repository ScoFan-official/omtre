import fs from "node:fs";
import path from "node:path";

import { DIR_NAMES } from "../constants/paths.js";
import { isManagedPath, isManagedRootDir } from "../configurators/index.js";

export const OMTRE_BLOCK_START = "<!-- OMTRE:START -->";
export const OMTRE_BLOCK_END = "<!-- OMTRE:END -->";
export const OMTRE_COPILOT_GUIDANCE_START =
  "<!-- OMTRE:COPILOT-GUIDANCE:START -->";
export const OMTRE_COPILOT_GUIDANCE_END = "<!-- OMTRE:COPILOT-GUIDANCE:END -->";
export const OMTRE_HOOK_INJECTED_MARKER = "omtre-hook-injected";
export const OMTRE_EMITTED_MARKER = "omtre-emitted";

function isWorkflowOrManagedPath(dirPosix: string): boolean {
  return (
    dirPosix === DIR_NAMES.WORKFLOW ||
    dirPosix.startsWith(`${DIR_NAMES.WORKFLOW}/`) ||
    isManagedPath(dirPosix)
  );
}

function isWorkflowOrManagedRootDir(dirPosix: string): boolean {
  return dirPosix === DIR_NAMES.WORKFLOW || isManagedRootDir(dirPosix);
}

/** Remove empty managed parents without deleting a managed root directory. */
export function cleanupEmptyDirs(cwd: string, dirPath: string): void {
  const dirPosix = dirPath.replace(/\\/g, "/");
  const segments = dirPosix.split("/");

  if (
    path.posix.isAbsolute(dirPosix) ||
    segments.some(
      (segment) => segment === "" || segment === "." || segment === "..",
    ) ||
    !isWorkflowOrManagedPath(dirPosix) ||
    isWorkflowOrManagedRootDir(dirPosix)
  ) {
    return;
  }

  const canonicalCwd = fs.realpathSync(cwd);
  const fullPath = path.resolve(canonicalCwd, ...segments);
  const relative = path.relative(canonicalCwd, fullPath);
  if (
    relative === "" ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    return;
  }
  if (!fs.existsSync(fullPath)) return;

  try {
    const canonicalFullPath = fs.realpathSync(fullPath);
    const canonicalRelative = path.relative(canonicalCwd, canonicalFullPath);
    if (
      canonicalRelative === "" ||
      canonicalRelative === ".." ||
      canonicalRelative.startsWith(`..${path.sep}`) ||
      path.isAbsolute(canonicalRelative)
    ) {
      return;
    }

    const stat = fs.lstatSync(fullPath);
    if (!stat.isDirectory() || stat.isSymbolicLink()) return;

    if (fs.readdirSync(fullPath).length === 0) {
      fs.rmdirSync(fullPath);
      const parent = path.posix.dirname(dirPosix);
      if (
        parent !== "." &&
        parent !== dirPosix &&
        !isWorkflowOrManagedRootDir(parent)
      ) {
        cleanupEmptyDirs(cwd, parent);
      }
    }
  } catch {
    // Cleanup is best-effort; permission/race failures leave the directory.
  }
}
