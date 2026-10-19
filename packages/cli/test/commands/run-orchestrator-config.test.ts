import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  loadOrchestratorConfig,
  parseOrchestratorSection,
  readWorkerDefault,
} from "../../src/commands/run/orchestrator.js";

// The dispatch-roster schema names the orchestrator through .omtre/config.yaml:
//
//   orchestrator:
//     agent: orchestrator
//     model: claude-opus-4-7
//     max_parallel: 1
//
// Same simple-YAML dialect as `channel.worker_guard` (see channel/guard.ts):
// flat `key: value` pairs under a top-level section header.
describe("parseOrchestratorSection", () => {
  it("returns undefined when the orchestrator section is absent", () => {
    expect(parseOrchestratorSection("")).toBeUndefined();
    expect(parseOrchestratorSection("# orchestrator: commented\n")).toBeUndefined();
    expect(
      parseOrchestratorSection(
        "worker_default: implement\nchannel:\n  worker_guard:\n    idle_timeout: 5m\n",
      ),
    ).toBeUndefined();
  });

  it("parses agent / model / max_parallel and defaults max_parallel to 1", () => {
    const parsed = parseOrchestratorSection(
      [
        "orchestrator:",
        "  agent: orchestrator",
        "  model: claude-opus-4-7",
        "  max_parallel: 2",
        "worker_default: implement",
      ].join("\n"),
    );
    expect(parsed).toEqual({
      agent: "orchestrator",
      model: "claude-opus-4-7",
      maxParallel: 2,
    });

    // max_parallel omitted → the schema default is 1 (fail-closed to serial).
    const withoutMax = parseOrchestratorSection(
      "orchestrator:\n  agent: orchestrator\n",
    );
    expect(withoutMax?.maxParallel).toBe(1);
    expect(withoutMax?.agent).toBe("orchestrator");
    expect(withoutMax?.model).toBeUndefined();
  });

  it("skips comments and blank lines inside the section", () => {
    const parsed = parseOrchestratorSection(
      [
        "orchestrator:",
        "  # which card runs the loop",
        "  agent: orchestrator",
        "",
        "  max_parallel: 3",
      ].join("\n"),
    );
    expect(parsed).toEqual({
      agent: "orchestrator",
      model: undefined,
      maxParallel: 3,
    });
  });

  it("ignores unknown keys but keeps the known ones", () => {
    const parsed = parseOrchestratorSection(
      "orchestrator:\n  agent: orch\n  surprise: yes\n",
    );
    expect(parsed?.agent).toBe("orch");
    expect(parsed?.maxParallel).toBe(1);
  });

  it("an empty orchestrator: section still defaults max_parallel to 1", () => {
    expect(parseOrchestratorSection("orchestrator:\n")).toEqual({
      agent: undefined,
      model: undefined,
      maxParallel: 1,
    });
  });

  it("rejects a non-integer or non-positive max_parallel", () => {
    expect(() =>
      parseOrchestratorSection("orchestrator:\n  max_parallel: soon\n"),
    ).toThrow(/max_parallel must be a positive integer/);
    expect(() =>
      parseOrchestratorSection("orchestrator:\n  max_parallel: 0\n"),
    ).toThrow(/max_parallel must be a positive integer/);
    expect(() =>
      parseOrchestratorSection("orchestrator:\n  max_parallel: -2\n"),
    ).toThrow(/max_parallel must be a positive integer/);
  });

  it("an indented 'orchestrator:' inside another section does not start a new section", () => {
    expect(
      parseOrchestratorSection("channel:\n  orchestrator:\n    agent: x\n"),
    ).toBeUndefined();
  });

  it("last scalar wins for repeated keys", () => {
    const parsed = parseOrchestratorSection(
      "orchestrator:\n  agent: first\n  agent: second\n",
    );
    expect(parsed?.agent).toBe("second");
  });
});

describe("loadOrchestratorConfig", () => {
  it("returns undefined when .omtre/config.yaml is missing or has no section", () => {
    const tmp = fs.mkdtempSync(
      path.join(fs.realpathSync(os.tmpdir()), "orch-cfg-"),
    );
    try {
      expect(loadOrchestratorConfig(tmp)).toBeUndefined();
      fs.mkdirSync(path.join(tmp, ".omtre"), { recursive: true });
      fs.writeFileSync(
        path.join(tmp, ".omtre", "config.yaml"),
        "autonomy: hands-off\nworker_default: implement\n",
      );
      expect(loadOrchestratorConfig(tmp)).toBeUndefined();
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("reads the section from .omtre/config.yaml", () => {
    const tmp = fs.mkdtempSync(
      path.join(fs.realpathSync(os.tmpdir()), "orch-cfg-"),
    );
    try {
      fs.mkdirSync(path.join(tmp, ".omtre"), { recursive: true });
      fs.writeFileSync(
        path.join(tmp, ".omtre", "config.yaml"),
        [
          "autonomy: hands-off",
          "orchestrator:",
          "  agent: orchestrator",
          "  model: claude-opus-4-7",
        ].join("\n"),
      );
      expect(loadOrchestratorConfig(tmp)).toEqual({
        agent: "orchestrator",
        model: "claude-opus-4-7",
        maxParallel: 1,
      });
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe("readWorkerDefault", () => {
  function withConfig(content: string | undefined): string {
    const tmp = fs.mkdtempSync(
      path.join(fs.realpathSync(os.tmpdir()), "worker-default-"),
    );
    if (content !== undefined) {
      fs.mkdirSync(path.join(tmp, ".omtre"), { recursive: true });
      fs.writeFileSync(path.join(tmp, ".omtre", "config.yaml"), content);
    }
    return tmp;
  }

  it("returns the worker_default card name, undefined when unset", () => {
    const missing = withConfig(undefined);
    const unset = withConfig("autonomy: hands-off\n");
    const set = withConfig(
      'worker_default: implement\norchestrator:\n  agent: orchestrator\n',
    );
    try {
      expect(readWorkerDefault(missing)).toBeUndefined();
      expect(readWorkerDefault(unset)).toBeUndefined();
      expect(readWorkerDefault(set)).toBe("implement");
    } finally {
      for (const d of [missing, unset, set]) {
        fs.rmSync(d, { recursive: true, force: true });
      }
    }
  });

  it("ignores an indented worker_default inside another section", () => {
    const tmp = withConfig("orchestrator:\n  worker_default: nested\n");
    try {
      expect(readWorkerDefault(tmp)).toBeUndefined();
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
