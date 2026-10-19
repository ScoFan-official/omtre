import { describe, expect, it } from "vitest";
import {
  CLI_BIN_NAME,
  CLI_SHORT_BIN_NAME,
  DIR_NAMES,
  FILE_NAMES,
  HOME_DIR_NAME,
  PATHS,
  SKILL_PREFIX,
  SLASH_COMMAND_NS,
  getWorkspaceDir,
  getTaskDir,
  getArchiveDir,
} from "../../src/constants/paths.js";
import { PACKAGE_NAME, VERSION } from "../../src/constants/version.js";
import {
  OMTRE_BLOCK_END,
  OMTRE_BLOCK_START,
  OMTRE_COPILOT_GUIDANCE_END,
  OMTRE_COPILOT_GUIDANCE_START,
  OMTRE_EMITTED_MARKER,
  OMTRE_HOOK_INJECTED_MARKER,
} from "../../src/utils/managed-paths.js";

// =============================================================================
// DIR_NAMES — constant structure
// =============================================================================

describe("DIR_NAMES", () => {
  it("has all expected keys", () => {
    expect(DIR_NAMES).toHaveProperty("WORKFLOW");
    expect(DIR_NAMES).toHaveProperty("WORKSPACE", "workspace");
    expect(DIR_NAMES).toHaveProperty("TASKS", "tasks");
    expect(DIR_NAMES).toHaveProperty("ARCHIVE", "archive");
    expect(DIR_NAMES).toHaveProperty("SPEC", "spec");
    expect(DIR_NAMES).toHaveProperty("SCRIPTS", "scripts");
    expect(DIR_NAMES).toHaveProperty("AGENTS", "agents");
    expect(DIR_NAMES).toHaveProperty("DOMAINS", "domains");
  });

  it("WORKFLOW is .omtre", () => {
    expect(DIR_NAMES.WORKFLOW).toBe(".omtre");
  });

  it("all values are non-empty strings", () => {
    for (const value of Object.values(DIR_NAMES)) {
      expect(typeof value).toBe("string");
      expect(value.length).toBeGreaterThan(0);
    }
  });
});

// =============================================================================
// Top-level CLI and home directory constants
// =============================================================================

describe("CLI and home directory constants", () => {
  it("exports HOME_DIR_NAME as .omtre", () => {
    expect(HOME_DIR_NAME).toBe(".omtre");
  });

  it("exports CLI binary and command prefix constants", () => {
    expect(CLI_BIN_NAME).toBe("omtre");
    expect(CLI_SHORT_BIN_NAME).toBe("omt");
    expect(SKILL_PREFIX).toBe("omtre-");
    expect(SLASH_COMMAND_NS).toBe("omt");
  });
});

// =============================================================================
// FILE_NAMES — constant structure
// =============================================================================

describe("FILE_NAMES", () => {
  it("has all expected keys", () => {
    expect(FILE_NAMES).toHaveProperty("AGENTS");
    expect(FILE_NAMES).toHaveProperty("DEVELOPER");
    expect(FILE_NAMES).toHaveProperty("CURRENT_TASK");
    expect(FILE_NAMES).toHaveProperty("TASK_JSON");
    expect(FILE_NAMES).toHaveProperty("PRD");
    expect(FILE_NAMES).toHaveProperty("WORKFLOW_GUIDE");
    expect(FILE_NAMES).toHaveProperty("JOURNAL_PREFIX");
    expect(FILE_NAMES.CONFIG_YAML).toBe("config.yaml");
    expect(FILE_NAMES.VERSION).toBe(".version");
    expect(FILE_NAMES.TEMPLATE_HASHES).toBe(".template-hashes.json");
    expect(FILE_NAMES.HOOKS_LOCAL).toBe("hooks.local.json");
    expect(FILE_NAMES.RUNTIME_DIR).toBe(".runtime");
    expect(FILE_NAMES.RALPH_STATE).toBe(".ralph-state.json");
    expect(FILE_NAMES.MIGRATED_FROM).toBe(".migrated-from");
  });

  it("all values are non-empty strings", () => {
    for (const value of Object.values(FILE_NAMES)) {
      expect(typeof value).toBe("string");
      expect(value.length).toBeGreaterThan(0);
    }
  });
});

// =============================================================================
// version.ts and managed-paths.ts constants
// =============================================================================

describe("version and managed-paths constants", () => {
  it("exports PACKAGE_NAME as omtre and non-empty VERSION", () => {
    expect(PACKAGE_NAME).toBe("omtre");
    expect(typeof VERSION).toBe("string");
    expect(VERSION.length).toBeGreaterThan(0);
  });

  it("exports OMTRE managed block and hook markers", () => {
    expect(OMTRE_BLOCK_START).toBe("<!-- OMTRE:START -->");
    expect(OMTRE_BLOCK_END).toBe("<!-- OMTRE:END -->");
    expect(OMTRE_COPILOT_GUIDANCE_START).toBe(
      "<!-- OMTRE:COPILOT-GUIDANCE:START -->",
    );
    expect(OMTRE_COPILOT_GUIDANCE_END).toBe(
      "<!-- OMTRE:COPILOT-GUIDANCE:END -->",
    );
    expect(OMTRE_HOOK_INJECTED_MARKER).toBe("omtre-hook-injected");
    expect(OMTRE_EMITTED_MARKER).toBe("omtre-emitted");
  });
});

// =============================================================================
// PATHS — derived from DIR_NAMES + FILE_NAMES
// =============================================================================

describe("PATHS", () => {
  it("WORKFLOW equals DIR_NAMES.WORKFLOW", () => {
    expect(PATHS.WORKFLOW).toBe(DIR_NAMES.WORKFLOW);
  });

  it("all paths start with DIR_NAMES.WORKFLOW", () => {
    for (const value of Object.values(PATHS)) {
      expect(value.startsWith(DIR_NAMES.WORKFLOW)).toBe(true);
    }
  });

  it("WORKSPACE is WORKFLOW/workspace", () => {
    expect(PATHS.WORKSPACE).toBe(`${DIR_NAMES.WORKFLOW}/${DIR_NAMES.WORKSPACE}`);
  });

  it("TASKS is WORKFLOW/tasks", () => {
    expect(PATHS.TASKS).toBe(`${DIR_NAMES.WORKFLOW}/${DIR_NAMES.TASKS}`);
  });

  it("SPEC is WORKFLOW/spec", () => {
    expect(PATHS.SPEC).toBe(`${DIR_NAMES.WORKFLOW}/${DIR_NAMES.SPEC}`);
  });

  it("SCRIPTS is WORKFLOW/scripts", () => {
    expect(PATHS.SCRIPTS).toBe(`${DIR_NAMES.WORKFLOW}/${DIR_NAMES.SCRIPTS}`);
  });

  it("DEVELOPER_FILE is WORKFLOW/.developer", () => {
    expect(PATHS.DEVELOPER_FILE).toBe(
      `${DIR_NAMES.WORKFLOW}/${FILE_NAMES.DEVELOPER}`,
    );
  });

  it("CURRENT_TASK_FILE is WORKFLOW/.current-task", () => {
    expect(PATHS.CURRENT_TASK_FILE).toBe(
      `${DIR_NAMES.WORKFLOW}/${FILE_NAMES.CURRENT_TASK}`,
    );
  });

  it("WORKFLOW_GUIDE_FILE is WORKFLOW/workflow.md", () => {
    expect(PATHS.WORKFLOW_GUIDE_FILE).toBe(
      `${DIR_NAMES.WORKFLOW}/${FILE_NAMES.WORKFLOW_GUIDE}`,
    );
  });

  it("uses / separator (not backslash)", () => {
    for (const value of Object.values(PATHS)) {
      expect(value).not.toContain("\\");
    }
  });
});

// =============================================================================
// getWorkspaceDir — pure string concatenation
// =============================================================================

describe("getWorkspaceDir", () => {
  it("returns correct path for developer name", () => {
    expect(getWorkspaceDir("john")).toBe(".omtre/workspace/john");
  });

  it("handles hyphenated names", () => {
    expect(getWorkspaceDir("john-doe")).toBe(".omtre/workspace/john-doe");
  });

  it("handles empty string", () => {
    expect(getWorkspaceDir("")).toBe(".omtre/workspace/");
  });
});

// =============================================================================
// getTaskDir — pure string concatenation
// =============================================================================

describe("getTaskDir", () => {
  it("returns correct path for task name", () => {
    expect(getTaskDir("01-21-my-task")).toBe(".omtre/tasks/01-21-my-task");
  });

  it("handles nested-looking names", () => {
    expect(getTaskDir("sub/task")).toBe(".omtre/tasks/sub/task");
  });

  it("handles empty string", () => {
    expect(getTaskDir("")).toBe(".omtre/tasks/");
  });
});

// =============================================================================
// getArchiveDir — pure, no arguments
// =============================================================================

describe("getArchiveDir", () => {
  it("returns correct archive path", () => {
    expect(getArchiveDir()).toBe(".omtre/tasks/archive");
  });

  it("is under PATHS.TASKS", () => {
    expect(getArchiveDir().startsWith(PATHS.TASKS + "/")).toBe(true);
  });
});
