import { describe, expect, it } from "vitest";
import { getAllAgents } from "../../src/templates/kimi/index.js";
import { applyPullBasedPreludeMarkdown } from "../../src/configurators/shared.js";
import { collectKimiTemplates } from "../../src/configurators/kimi.js";
import { collectPiTemplates } from "../../src/configurators/pi.js";

const EXPECTED_AGENT_NAMES = [
  "omtre-check",
  "omtre-implement",
  "omtre-research",
];

describe("kimi getAllAgents", () => {
  it("returns the expected agent prompt set", () => {
    const agents = getAllAgents();
    const names = agents.map((agent) => agent.name);
    expect(names).toEqual(EXPECTED_AGENT_NAMES);
  });

  it("each agent is a Markdown file with YAML frontmatter (Kimi SKILL.md requires name + description)", () => {
    for (const agent of getAllAgents()) {
      const content = agent.content.replace(/\r\n/g, "\n");
      expect(content.length).toBeGreaterThan(0);
      expect(content).toMatch(/^---\n/);
      expect(content).toContain("name: ");
      expect(content).toContain("description:");
      // Kimi agents document dispatch through `.kimi-code/agents/` sub-agents
      expect(content).toContain(".kimi-code/agents/");
    }
  });

  it("documents dispatch via the Agent tool with an Active task: prompt", () => {
    for (const agent of getAllAgents()) {
      // Dispatch contract: main session dispatches the custom sub-agent via
      // the Agent tool, and the prompt starts with the active task path.
      expect(agent.content).toContain(
        `dispatches the \`${agent.name}\` sub-agent via the Agent tool`,
      );
      expect(agent.content).toContain("Starts with `Active task: <path");
    }
  });

  it("dispatches research as a custom sub-agent with write scope limited to research/", () => {
    const research = getAllAgents().find(
      (agent) => agent.name === "omtre-research",
    );
    expect(research).toBeDefined();
    if (!research) return;

    expect(research.content).toContain(
      "dispatches the `omtre-research` sub-agent",
    );
    expect(research.content).toContain("may write only under");
    expect(research.content).not.toContain("built-in `coder` sub-agent");
  });
});

describe("kimi pull-based prelude injection", () => {
  it("injects context-loading instructions only into implement/check", () => {
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

  it("does not inject the pull-based prelude into research", () => {
    const agents = applyPullBasedPreludeMarkdown(getAllAgents());
    const research = agents.find((agent) => agent.name === "omtre-research");
    expect(research).toBeDefined();
    if (!research) return;
    expect(research.content).not.toContain("Load Omtre Context First");
    expect(research.content).toContain("{TASK_DIR}/research/");
  });
});

describe("kimi collectKimiTemplates", () => {
  it("writes commands-as-skills and agent prompts under .kimi-code/skills/", () => {
    const files = collectKimiTemplates();

    // User-invocable entry points (/skill:omtre-<name>)
    expect(files.has(".kimi-code/skills/omtre-start/SKILL.md")).toBe(true);
    expect(files.has(".kimi-code/skills/omtre-continue/SKILL.md")).toBe(true);
    expect(files.has(".kimi-code/skills/omtre-finish-work/SKILL.md")).toBe(
      true,
    );

    // Omtre agent prompts (also installed as `.kimi-code/agents/*.md`)
    expect(files.has(".kimi-code/skills/omtre-implement/SKILL.md")).toBe(
      true,
    );
    expect(files.has(".kimi-code/skills/omtre-check/SKILL.md")).toBe(true);
    expect(files.has(".kimi-code/skills/omtre-research/SKILL.md")).toBe(true);

    const implement = files.get(".kimi-code/skills/omtre-implement/SKILL.md");
    expect(implement).toContain("Load Omtre Context First");
    const research = files.get(".kimi-code/skills/omtre-research/SKILL.md");
    expect(research).not.toContain("Load Omtre Context First");

    // Custom sub-agent definitions under .kimi-code/agents/ mirror the skill
    // copies (pull-based prelude included).
    for (const name of [
      "omtre-implement",
      "omtre-check",
      "omtre-research",
    ]) {
      const agent = files.get(`.kimi-code/agents/${name}.md`);
      expect(agent, `.kimi-code/agents/${name}.md`).toBeDefined();
      expect(agent).toContain(`name: ${name}`);
      expect(agent).toContain("tools: ");
    }
    expect(files.get(".kimi-code/agents/omtre-implement.md")).toContain(
      "Load Omtre Context First",
    );
    expect(files.get(".kimi-code/agents/omtre-research.md")).not.toContain(
      "Load Omtre Context First",
    );

    // No hooks/settings/extension files — Kimi has no project-level hook or
    // settings surface Omtre may write.
    for (const key of files.keys()) {
      expect(key.startsWith(".kimi-code/hooks")).toBe(false);
      expect(key).not.toBe(".kimi-code/settings.json");
      expect(key).not.toBe(".kimi-code/config.toml");
    }
  });

  it("writes workflow + bundled skills to the shared .agents/skills/ root", () => {
    const files = collectKimiTemplates();
    expect(files.has(".agents/skills/omtre-check/SKILL.md")).toBe(true);
    expect(files.has(".agents/skills/omtre-before-dev/SKILL.md")).toBe(true);
    expect(files.has(".agents/skills/omtre-meta/SKILL.md")).toBe(true);
    // Command-as-skill files stay Kimi-private (Codex owns the shared
    // omtre-start/continue/finish-work fallback copies).
    expect(files.has(".agents/skills/omtre-start/SKILL.md")).toBe(false);
    expect(files.has(".agents/skills/omtre-finish-work/SKILL.md")).toBe(
      false,
    );
  });

  it("renders .agents/skills/ files byte-identically to Pi's shared writes", () => {
    const kimiFiles = collectKimiTemplates();
    const piFiles = collectPiTemplates();
    for (const [key, content] of kimiFiles) {
      if (!key.startsWith(".agents/skills/")) continue;
      expect(
        piFiles.get(key),
        `${key} must be byte-identical to Pi's shared-skill write`,
      ).toBe(content);
    }
  });
});
