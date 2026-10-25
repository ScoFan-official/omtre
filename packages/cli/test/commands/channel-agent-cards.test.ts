import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  CHECK_AXES,
  findAgentFile,
  loadAgent,
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
      { ".omtre/agents/check.md": CARD("check") },
      (cwd) => {
        expect(resolveCheckAxisCard("standards", cwd)).toBe("check");
        expect(resolveCheckAxisCard("spec", cwd)).toBe("check");
      },
    );
  });

  it("prefers check.standards / check.spec sub-cards when they exist", () => {
    withAgents(
      {
        ".omtre/agents/check.md": CARD("check"),
        ".omtre/agents/check.standards.md": CARD("check.standards"),
        ".omtre/agents/check.spec.md": CARD("check.spec"),
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
        ".omtre/agents/check.md": CARD("check"),
        ".omtre/agents/check.standards.md": CARD("check.standards"),
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
        ".omtre/agents/check.spec/AGENT.md": CARD("check.spec"),
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

// Tickets run inside `git worktree` checkouts — on Windows with
// `core.autocrlf` every committed card lands on disk as CRLF. The flat
// frontmatter parser must tolerate \r\n or every key (provider,
// acp_target, ...) silently drops and spawn fails downstream.
describe("loadAgent line endings", () => {
  function withCard(content: string, fn: (cwd: string) => void): void {
    const tmp = fs.mkdtempSync(
      path.join(fs.realpathSync(os.tmpdir()), "crlf-card-"),
    );
    try {
      const p = path.join(tmp, ".omtre", "agents", "worker.md");
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, content);
      fn(tmp);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }

  const CARD = [
    "---",
    "name: worker",
    "description: |",
    "  multiline card",
    "  description",
    "provider: acp",
    "acp_target: grok-build",
    "model: grok-4.7",
    "---",
    "",
    "body",
  ];

  it("parses frontmatter identically for LF and CRLF cards", () => {
    const lf = CARD.join("\n") + "\n";
    const crlf = CARD.join("\r\n") + "\r\n";
    const expected = {
      name: "worker",
      description: "multiline card\ndescription",
      provider: "acp",
      acp_target: "grok-build",
      model: "grok-4.7",
    };
    for (const [label, content] of [
      ["lf", lf],
      ["crlf", crlf],
    ] as const) {
      withCard(content, (cwd) => {
        const agent = loadAgent("worker", cwd);
        expect(agent.provider, label).toBe("acp");
        expect(agent.model, label).toBe("grok-4.7");
        expect(agent.raw, label).toEqual(expected);
        expect(agent.systemPrompt, label).toBe("body");
      });
    }
  });
});

// Containment must compare realpaths on both sides. A cwd reached through a
// symlinked prefix (macOS `/var -> /private/var`, a checkout behind a link)
// otherwise never prefix-matches its own cards, and dispatch refuses with
// "card not found" even though the card is right there.
describe("findAgentFile containment", () => {
  const CARD = [
    "---",
    "name: implement",
    "provider: claude",
    "---",
    "",
    "body",
  ].join("\n");

  function tmp(prefix: string): string {
    return fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), prefix));
  }

  it.skipIf(process.platform === "win32")(
    "resolves a card when cwd is reached through a symlink",
    () => {
      const real = tmp("alias-real-");
      const linkParent = tmp("alias-link-");
      const alias = path.join(linkParent, "repo");
      fs.mkdirSync(path.join(real, ".omtre", "agents"), { recursive: true });
      fs.writeFileSync(
        path.join(real, ".omtre", "agents", "implement.md"),
        CARD,
      );
      fs.symlinkSync(real, alias, "dir");
      try {
        expect(findAgentFile("implement", alias)).toBe(
          path.join(alias, ".omtre", "agents", "implement.md"),
        );
      } finally {
        fs.rmSync(linkParent, { recursive: true, force: true });
        fs.rmSync(real, { recursive: true, force: true });
      }
    },
  );

  it.skipIf(process.platform === "win32")(
    "still refuses an agents dir that is itself a symlink outside the repo",
    () => {
      const repo = tmp("agents-link-repo-");
      const outside = tmp("agents-link-outside-");
      fs.mkdirSync(path.join(repo, ".omtre"), { recursive: true });
      fs.writeFileSync(path.join(outside, "implement.md"), CARD);
      fs.symlinkSync(outside, path.join(repo, ".omtre", "agents"), "dir");
      try {
        expect(findAgentFile("implement", repo)).toBeNull();
        expect(
          findAgentFile("implement", repo, [fs.realpathSync(outside)]),
        ).toBe(path.join(repo, ".omtre", "agents", "implement.md"));
      } finally {
        fs.rmSync(repo, { recursive: true, force: true });
        fs.rmSync(outside, { recursive: true, force: true });
      }
    },
  );
});
