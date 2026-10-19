import { describe, expect, it } from "vitest";
import { collectDshTemplates } from "../../src/configurators/dsh.js";
import { collectPiTemplates } from "../../src/configurators/pi.js";

describe("dsh collectDshTemplates", () => {
  it("writes entry skills under .dsh/skills/ (dsh-native project root)", () => {
    const files = collectDshTemplates();

    // User-invocable entry points (no slash palette → delivered as skills)
    expect(files.has(".dsh/skills/omtre-start/SKILL.md")).toBe(true);
    expect(files.has(".dsh/skills/omtre-continue/SKILL.md")).toBe(true);
    expect(files.has(".dsh/skills/omtre-finish-work/SKILL.md")).toBe(true);

    // Platform-resolved placeholders: get_context.py calls carry --platform dsh
    const start = files.get(".dsh/skills/omtre-start/SKILL.md");
    expect(start).toContain("--platform dsh");
    expect(start).toContain("name: omtre-start");
  });

  it("renders CMD_REF as bare omtre-<name> skill references in entry skills", () => {
    const files = collectDshTemplates();
    const finish = files.get(".dsh/skills/omtre-finish-work/SKILL.md");
    // `{{CMD_REF:finish-work}}` → `` `omtre-finish-work` `` (dsh loads
    // skills by name through its skill-loader tool)
    expect(finish).toContain("`omtre-finish-work`");
  });

  it("writes workflow + bundled skills to the shared .agents/skills/ root only", () => {
    const files = collectDshTemplates();
    expect(files.has(".agents/skills/omtre-check/SKILL.md")).toBe(true);
    expect(files.has(".agents/skills/omtre-before-dev/SKILL.md")).toBe(true);
    expect(files.has(".agents/skills/omtre-meta/SKILL.md")).toBe(true);
    // Command-as-skill files stay dsh-private (Codex owns the shared
    // omtre-start/continue/finish-work fallback copies).
    expect(files.has(".agents/skills/omtre-start/SKILL.md")).toBe(false);
    expect(files.has(".agents/skills/omtre-finish-work/SKILL.md")).toBe(
      false,
    );
  });

  it("renders .agents/skills/ files byte-identically to Pi's shared writes", () => {
    const dshFiles = collectDshTemplates();
    const piFiles = collectPiTemplates();
    for (const [key, content] of dshFiles) {
      if (!key.startsWith(".agents/skills/")) continue;
      expect(
        piFiles.get(key),
        `${key} must be byte-identical to Pi's shared-skill write`,
      ).toBe(content);
    }
  });

  it("ships an operator guide and no hooks/settings files", () => {
    const files = collectDshTemplates();
    expect(files.get(".dsh/DSH.md")).toBeDefined();
    for (const key of files.keys()) {
      expect(key.startsWith(".dsh/hooks")).toBe(false);
      expect(key).not.toBe(".dsh/settings.json");
      expect(key).not.toBe(".dsh/config.toml");
    }
  });
});
