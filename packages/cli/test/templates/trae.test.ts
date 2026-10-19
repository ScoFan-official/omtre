import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getAllAgents, getSettingsTemplate } from "../../src/templates/trae/index.js";
import {
  resolveAllAsSkills,
  resolveSkills,
  resolveBundledSkills,
  applyPullBasedPreludeMarkdown,
} from "../../src/configurators/shared.js";
import { AI_TOOLS } from "../../src/types/ai-tools.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../../..");

const EXPECTED_AGENT_NAMES = [
  "omtre-check",
  "omtre-implement",
  "omtre-research",
];

// Shared skills are sourced from common/ via resolveAllAsSkills (written to
// .trae/skills/ — Trae has its own private config dir, no .agents/skills alias).
describe("trae shared skills (from common source)", () => {
  it("resolves all common templates for trae context", () => {
    const skills = resolveAllAsSkills(AI_TOOLS.trae.templateContext);
    expect(skills.length).toBeGreaterThan(0);
    for (const skill of skills) {
      expect(skill.content).toContain("description:");
      expect(skill.content).toContain(`name: ${skill.name}`);
    }
  });

  it("does not include platform-specific syntax in resolved output", () => {
    const skills = resolveAllAsSkills(AI_TOOLS.trae.templateContext);
    for (const skill of skills) {
      // Trae uses /omtre- prefix, not /omt:
      expect(skill.content).not.toContain("/omt:");
      expect(skill.content).not.toContain(".claude/");
      expect(skill.content).not.toContain(".cursor/");
    }
  });

  it("resolves bundled skills for trae context", () => {
    const bundled = resolveBundledSkills(AI_TOOLS.trae.templateContext);
    expect(bundled.length).toBeGreaterThan(0);
  });

  it("resolves auto-triggered skills (resolveSkills) for trae context", () => {
    const skills = resolveSkills(AI_TOOLS.trae.templateContext);
    expect(skills.length).toBeGreaterThan(0);
    for (const skill of skills) {
      expect(skill.content).toContain("description:");
      expect(skill.content).toContain(`name: ${skill.name}`);
    }
  });
});

describe("trae getAllAgents", () => {
  it("returns the expected custom agent set", () => {
    const agents = getAllAgents();
    const names = agents.map((agent) => agent.name);
    expect(names).toEqual(EXPECTED_AGENT_NAMES);
  });

  it("each agent is a Markdown file with YAML frontmatter", () => {
    for (const agent of getAllAgents()) {
      expect(agent.content.length).toBeGreaterThan(0);
      expect(agent.content).toMatch(/^---\n/);
      expect(agent.content).toContain("name: ");
      expect(agent.content).toContain("description:");
    }
  });
});

// =============================================================================
// Trae sub-agent recursion guard (mirrors codex issue #234)
// =============================================================================
//
// omtre-implement / omtre-check agent markdown MUST contain a hard recursion
// guard so the dispatched sub-agent does not spawn another
// omtre-implement / omtre-check sub-agent.
describe("trae sub-agent recursion guard", () => {
  for (const name of ["omtre-implement", "omtre-check"] as const) {
    it(`${name}.md forbids spawning omtre-implement / omtre-check`, () => {
      const mdPath = path.join(
        repoRoot,
        "packages/cli/src/templates/trae/agents",
        `${name}.md`,
      );
      const content = fs.readFileSync(mdPath, "utf-8");
      // Hard prohibition keyword
      expect(content).toMatch(/Do NOT spawn/i);
      // Mentions both sibling agent kinds explicitly
      expect(content).toContain("omtre-implement");
      expect(content).toContain("omtre-check");
      // Mentions the leakage source so the reader knows why
      expect(content).toMatch(
        /SessionStart|dispatch.*main session|breadcrumb/i,
      );
    });
  }
});

describe("trae has no config.toml (no Codex CLI trust mechanism)", () => {
  it("does not ship a config.toml template", () => {
    const configPath = path.join(
      repoRoot,
      "packages/cli/src/templates/trae/config.toml",
    );
    expect(fs.existsSync(configPath)).toBe(false);
  });
});

describe("trae hooks.json registers SessionStart + UserPromptSubmit", () => {
  const hooksPath = path.join(
    repoRoot,
    "packages/cli/src/templates/trae/hooks.json",
  );

  it("includes version field and wires session-start.py under SessionStart", () => {
    const raw = fs.readFileSync(hooksPath, "utf-8");
    const parsed = JSON.parse(raw) as { version?: number; hooks?: Record<string, unknown> };
    expect(parsed.version).toBe(1);
    expect(parsed.hooks).toBeDefined();
    expect(Object.keys(parsed.hooks ?? {})).toContain("SessionStart");
    expect(raw).toContain(".trae/hooks/session-start.py");
    // Trae docs: matcher is only for PreToolUse/PostToolUse/Notification.
    // SessionStart fires once per new session (source: "startup" only).
    // Having matchers on SessionStart would cause 3x execution or be ignored.
    const sessionStartGroups = (parsed.hooks as Record<string, Record<string, unknown>[]>)["SessionStart"];
    expect(sessionStartGroups).toHaveLength(1);
    expect(sessionStartGroups[0]).not.toHaveProperty("matcher");
  });

  it("wires inject-workflow-state.py under UserPromptSubmit", () => {
    const raw = fs.readFileSync(hooksPath, "utf-8");
    const parsed = JSON.parse(raw) as { hooks?: Record<string, unknown> };
    expect(parsed.hooks).toBeDefined();
    expect(Object.keys(parsed.hooks ?? {})).toContain("UserPromptSubmit");
    expect(raw).toContain(".trae/hooks/inject-workflow-state.py");
  });

  it("wires inject-shell-session-context.py under PreToolUse with a Bash matcher", () => {
    // Trae gives a shell command's session id to hooks only, never to the
    // command's own environment, so the pre-shell ticket is how `task.py`
    // learns which session it belongs to. PreToolUse is one of the events
    // whose matcher Trae honors (see the SessionStart test above).
    const raw = fs.readFileSync(hooksPath, "utf-8");
    const parsed = JSON.parse(raw) as { hooks?: Record<string, unknown> };
    const preToolUseGroups = (
      parsed.hooks as Record<string, Record<string, unknown>[]>
    )["PreToolUse"];
    expect(preToolUseGroups).toHaveLength(1);
    // Trae's IDE names its shell tool `RunCommand`, not `Bash` — a `Bash`-only
    // matcher never fired. `Bash` is kept in the alternation because matcher is
    // a regex on every surface and dropping it would be an untested narrowing.
    expect(preToolUseGroups[0].matcher).toBe("RunCommand|Bash");
    expect(raw).toContain(".trae/hooks/inject-shell-session-context.py");
  });

  it("does not register any other hook events", () => {
    const raw = fs.readFileSync(hooksPath, "utf-8");
    const parsed = JSON.parse(raw) as { hooks?: Record<string, unknown> };
    expect(Object.keys(parsed.hooks ?? {}).sort()).toEqual(
      ["PreToolUse", "SessionStart", "UserPromptSubmit"].sort(),
    );
  });

  it("UserPromptSubmit hook group has no matcher", () => {
    const raw = fs.readFileSync(hooksPath, "utf-8");
    const parsed = JSON.parse(raw) as { hooks?: Record<string, unknown> };
    const userPromptGroups = (parsed.hooks as Record<string, Record<string, unknown>[]>)["UserPromptSubmit"];
    expect(userPromptGroups).toHaveLength(1);
    expect(userPromptGroups[0]).not.toHaveProperty("matcher");
  });
});

describe("trae getSettingsTemplate", () => {
  it("returns hooks.json as the target path with version field", () => {
    const settings = getSettingsTemplate();
    expect(settings.targetPath).toBe("hooks.json");
    expect(settings.content).toContain("\"version\": 1");
    expect(settings.content).toContain("SessionStart");
    expect(settings.content).toContain("UserPromptSubmit");
  });
});

// inject-workflow-state.py is shared across platforms; its _detect_platform()
// must map a hook installed under .trae/ to the "trae" platform so the
// breadcrumb is emitted with the right context (mirrors the .codex branch).
describe("trae platform detection in shared inject-workflow-state.py", () => {
  it("_detect_platform returns 'trae' for a .trae script path", () => {
    const hookPath = path.join(
      repoRoot,
      "packages/cli/src/templates/shared-hooks/inject-workflow-state.py",
    );
    const content = fs.readFileSync(hookPath, "utf-8");
    expect(content).toMatch(/if "\.trae" in script_parts:\s*\n\s*return "trae"/);
  });
});

// session-start.py is also a shared hook for Trae; it must detect .trae paths
// and TRAE_PROJECT_DIR env so the SessionStart context is emitted correctly.
describe("trae platform detection in shared session-start.py", () => {
  it("detects .trae directory and TRAE_PROJECT_DIR env", () => {
    const hookPath = path.join(
      repoRoot,
      "packages/cli/src/templates/shared-hooks/session-start.py",
    );
    const content = fs.readFileSync(hookPath, "utf-8");
    expect(content).toMatch(/if "\.trae" in script_parts:\s*\n\s*return "trae"/);
    expect(content).toContain("TRAE_PROJECT_DIR");
  });
});

// =============================================================================
// Pull-based prelude (class-2 platform)
// =============================================================================
//
// Trae is a class-2 (pull-based) platform: hooks cannot mutate sub-agent
// prompts. The implement/check agents must have a pull-based prelude injected
// so they load Omtre context themselves.
describe("trae pull-based prelude injection (class-2)", () => {
  it("applyPullBasedPreludeMarkdown injects context-loading instructions", () => {
    const agents = applyPullBasedPreludeMarkdown(getAllAgents());
    for (const agent of agents) {
      if (
        agent.name === "omtre-implement" ||
        agent.name === "omtre-check"
      ) {
        expect(agent.content).toContain("Load Omtre Context First");
        expect(agent.content).toContain("task.py current --source");
      }
    }
  });

  it("research agent does not get the prelude (no task context needed)", () => {
    const agents = applyPullBasedPreludeMarkdown(getAllAgents());
    const research = agents.find((a) => a.name === "omtre-research");
    expect(research).toBeDefined();
    if (!research) return; // guard for type-safety
    expect(research.content).not.toContain("Load Omtre Context First");
  });
});
