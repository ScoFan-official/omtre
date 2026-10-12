import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  CHECK_AXES,
  resolveCheckAxisCard,
} from "../../src/commands/channel/agent-loader.js";

// Dispatch-roster schema, check specialization: `check.standards` /
// `check.spec` are OPTIONAL per-repo sub-cards. When present they win over the
// generic `check` card so the two axes can run on different executors; when
// absent the roster falls back to `check` (never to an unrelated card).
describe("resolveCheckAxisCard", () => {
  function withAgents(
    files: Record<string, string>,
    fn: (cwd: string) => void,
  ): void {
    const tmp = fs.mkdtempSync(
      path.join(fs.realpathSync(os.tmpdir()), "check-cards-"),
    );
    try {
      for (const [rel, content] of Object.entries(files)) {
        const p = path.join(tmp, rel);
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, content);
      }
      fn(tmp);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }

  const CARD = (name: string) =>
    ["---", `name: ${name}`, "provider: claude", "---", "", "body"].join("\n");

  it("falls back to `check` when no specialized card exists", () => {
    withAgents(
      { ".trellis/agents/check.md": CARD("check") },
      (cwd) => {
        expect(resolveCheckAxisCard("standards", cwd)).toBe("check");
        expect(resolveCheckAxisCard("spec", cwd)).toBe("check");
      },
    );
  });

  it("prefers check.standards / check.spec sub-cards when they exist", () => {
    withAgents(
      {
        ".trellis/agents/check.md": CARD("check"),
        ".trellis/agents/check.standards.md": CARD("check.standards"),
        ".trellis/agents/check.spec.md": CARD("check.spec"),
      },
      (cwd) => {
        expect(resolveCheckAxisCard("standards", cwd)).toBe("check.standards");
        expect(resolveCheckAxisCard("spec", cwd)).toBe("check.spec");
      },
    );
  });

  it("falls back per axis — a missing spec card does not block the standards card", () => {
    withAgents(
      {
        ".trellis/agents/check.md": CARD("check"),
        ".trellis/agents/check.standards.md": CARD("check.standards"),
      },
      (cwd) => {
        expect(resolveCheckAxisCard("standards", cwd)).toBe("check.standards");
        expect(resolveCheckAxisCard("spec", cwd)).toBe("check");
      },
    );
  });

  it("accepts the <name>/AGENT.md directory layout for sub-cards", () => {
    withAgents(
      {
        ".trellis/agents/check.spec/AGENT.md": CARD("check.spec"),
      },
      (cwd) => {
        expect(resolveCheckAxisCard("spec", cwd)).toBe("check.spec");
        expect(resolveCheckAxisCard("standards", cwd)).toBe("check");
      },
    );
  });

  it("CHECK_AXES names exactly the two known axes", () => {
    expect([...CHECK_AXES].sort()).toEqual(["spec", "standards"]);
  });
});
