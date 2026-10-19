import { describe, expect, it } from "vitest";
import { getAllAgents, getHooksConfig } from "../../src/templates/zcode/index.js";

const EXPECTED_AGENT_NAMES = [
  "omtre-check",
  "omtre-implement",
  "omtre-research",
];

describe("zcode getAllAgents", () => {
  it("returns the expected custom agent set", () => {
    const agents = getAllAgents();
    const names = agents.map((agent) => agent.name);
    expect(names).toEqual(EXPECTED_AGENT_NAMES);
  });

  it("each agent is a Markdown file with YAML frontmatter", () => {
    for (const agent of getAllAgents()) {
      const content = agent.content.replace(/\r\n/g, "\n");
      expect(content.length).toBeGreaterThan(0);
      expect(content).toMatch(/^---\n/);
      expect(content).toContain("name: ");
      expect(content).toContain("description:");
      expect(content).toContain("color:");
    }
  });
});

describe("zcode getHooksConfig", () => {
  it("targets .zcode/config.json (workspace config form)", () => {
    const cfg = getHooksConfig();
    expect(cfg.targetPath).toBe("config.json");
    expect(cfg.content.length).toBeGreaterThan(0);
  });

  it("enables hooks and registers SessionStart + UserPromptSubmit + PreToolUse under events", () => {
    // ZCode workspace config schema: { hooks: { enabled: true, events: {...} } }
    // (distinct from plugin hooks.json which omits the enabled/events wrapper).
    const cfg = getHooksConfig();
    expect(cfg.content).toContain('"enabled": true');
    expect(cfg.content).toContain('"events"');
    expect(cfg.content).toContain('"SessionStart"');
    expect(cfg.content).toContain('"UserPromptSubmit"');
    expect(cfg.content).toContain('"PreToolUse"');
    expect(cfg.content).toContain('"matcher": "Agent|Task"');
    expect(cfg.content).toContain("session-start.py");
    expect(cfg.content).toContain("inject-workflow-state.py");
    expect(cfg.content).toContain("inject-subagent-context.py");
    // Uses {{PYTHON_CMD}} placeholder so init resolves host python.
    expect(cfg.content).toContain("{{PYTHON_CMD}}");
  });

  it("anchors hook commands to the ZCode project root", () => {
    const cfg = JSON.parse(getHooksConfig().content) as {
      hooks: {
        events: Record<
          string,
          { hooks: { command: string }[] }[]
        >;
      };
    };

    const commands = Object.values(cfg.hooks.events).flatMap((entries) =>
      entries.flatMap((entry) => entry.hooks.map((hook) => hook.command)),
    );

    expect(commands).toEqual(
      expect.arrayContaining([
        '{{PYTHON_CMD}} "${ZCODE_PROJECT_DIR}/.zcode/hooks/session-start.py"',
        '{{PYTHON_CMD}} "${ZCODE_PROJECT_DIR}/.zcode/hooks/inject-workflow-state.py"',
        '{{PYTHON_CMD}} "${ZCODE_PROJECT_DIR}/.zcode/hooks/inject-subagent-context.py"',
      ]),
    );
    for (const command of commands) {
      expect(command).not.toMatch(/{{PYTHON_CMD}}\s+\.zcode\/hooks\//);
    }
  });
});

describe("zcode class-1 agent fallback protocol", () => {
  it("keeps source agents prelude-free but gives implement/check hook fallback instructions", () => {
    const agents = getAllAgents();
    for (const agent of agents) {
      if (
        agent.name === "omtre-implement" ||
        agent.name === "omtre-check"
      ) {
        expect(agent.content).not.toContain("Load Omtre Context First");
        expect(agent.content).toContain("Omtre Context Loading Protocol");
        expect(agent.content).toContain("<!-- omtre-hook-injected -->");
        expect(agent.content).toContain("Active task:");
      }
    }
  });

  it("does not add context fallback instructions to research", () => {
    const agents = getAllAgents();
    const research = agents.find((agent) => agent.name === "omtre-research");
    expect(research).toBeDefined();
    if (!research) return;
    expect(research.content).not.toContain("Omtre Context Loading Protocol");
    expect(research.content).not.toContain("Load Omtre Context First");
    expect(research.content).toContain("{TASK_DIR}/research/");
  });
});
