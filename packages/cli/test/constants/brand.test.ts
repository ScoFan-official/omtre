import { describe, expect, it } from "vitest";
import {
  BANNER_FONT,
  BANNER_TAGLINE,
  BANNER_TEXT,
  BRAND_NAME,
} from "../../src/constants/brand.js";

describe("brand identity", () => {
  it("renders the omtre wordmark", () => {
    expect(BANNER_TEXT).toBe("OMTRE");
    expect(BANNER_TEXT.toLowerCase()).toBe(BRAND_NAME);
  });

  it("uses an independent tagline and font", () => {
    expect(BANNER_TAGLINE).toContain("workflow harness");
    expect(BANNER_FONT).toBe("ANSI Shadow");
  });
});
