import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  collectReferencedAgents,
  collectMissingAgents,
} from "../../src/utils/agent-refs.js";

describe("collectReferencedAgents", () => {
  it("extracts names from `--agent <name>` flags", () => {
    const body = "Run `omtre channel spawn --agent implement` then check.";
    expect(collectReferencedAgents(body)).toEqual(["implement"]);
  });

  it("extracts names from `--agent=<name>` form", () => {
    const body = "use --agent=check for reviews";
    expect(collectReferencedAgents(body)).toEqual(["check"]);
  });

  it("extracts names from `.omtre/agents/<name>.md` literal paths", () => {
    const body = "Defined in .omtre/agents/architect.md";
    expect(collectReferencedAgents(body)).toEqual(["architect"]);
  });

  it("deduplicates and sorts results across both surface forms", () => {
    const body = `
      omtre channel spawn --agent implement
      omtre channel spawn --agent check
      see .omtre/agents/implement.md for details
      another reference: --agent check
    `;
    expect(collectReferencedAgents(body)).toEqual(["check", "implement"]);
  });

  it("returns empty array when no references are present", () => {
    expect(collectReferencedAgents("just normal text, no agents here")).toEqual(
      [],
    );
  });

  it("ignores names with path-traversal characters", () => {
    // `agent-loader.ts` rejects these, so we silently drop them here too.
    const body = "--agent ../escape";
    expect(collectReferencedAgents(body)).not.toContain("../escape");
  });
});

describe("collectMissingAgents", () => {
  let cwd: string;

  beforeEach(() => {
    cwd = fs.mkdtempSync(path.join(os.tmpdir(), "omtre-agent-refs-"));
    fs.mkdirSync(path.join(cwd, ".omtre", "agents"), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(cwd, { recursive: true, force: true });
  });

  it("returns referenced names that are not on disk", () => {
    fs.writeFileSync(
      path.join(cwd, ".omtre", "agents", "implement.md"),
      "---\nname: implement\n---\n",
    );
    const body = "--agent implement --agent check";
    expect(collectMissingAgents(cwd, body)).toEqual(["check"]);
  });

  it("returns [] when every referenced agent exists", () => {
    fs.writeFileSync(
      path.join(cwd, ".omtre", "agents", "implement.md"),
      "---\nname: implement\n---\n",
    );
    fs.writeFileSync(
      path.join(cwd, ".omtre", "agents", "check.md"),
      "---\nname: check\n---\n",
    );
    const body = "--agent implement --agent check";
    expect(collectMissingAgents(cwd, body)).toEqual([]);
  });

  it("recognizes the nested `<name>/AGENT.md` layout", () => {
    fs.mkdirSync(path.join(cwd, ".omtre", "agents", "designer"), {
      recursive: true,
    });
    fs.writeFileSync(
      path.join(cwd, ".omtre", "agents", "designer", "AGENT.md"),
      "---\nname: designer\n---\n",
    );
    expect(collectMissingAgents(cwd, "--agent designer")).toEqual([]);
  });

  it("returns [] when the workflow body has no references", () => {
    expect(collectMissingAgents(cwd, "plain text, no agents")).toEqual([]);
  });
});
