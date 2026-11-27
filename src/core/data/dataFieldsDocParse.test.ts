import { describe, expect, it } from "vitest";
import {
  parseDocumentedFields,
  shippedJsonSectionFiles,
  splitDataFieldsSections,
  validateFieldDescription,
} from "./dataFieldsDocParse";

describe("splitDataFieldsSections", () => {
  it("captures json sections and stops at the next non-file heading", () => {
    const sections = splitDataFieldsSections(
      [
        "# Intro",
        "## enemies.json",
        "enemy body",
        "## Notes",
        "not a file",
        "## waves.json",
        "wave body",
      ].join("\n"),
    );
    expect(sections.get("enemies.json")).toBe("enemy body");
    expect(sections.get("waves.json")).toBe("wave body");
    expect(sections.has("Notes")).toBe(false);
  });
});

describe("parseDocumentedFields", () => {
  it("parses table rows and bullets, including a following description line", () => {
    const fields = parseDocumentedFields(
      [
        "| Field | Meaning |",
        "| `hp` | **Hit** points of the `enemy`. |",
        "- `speedWu` — Movement speed in world units",
        "- `weight`",
        "Mass used by knockback, at least fifteen.",
        "- `skipped`",
        "- next bullet has no description",
        "- `hashed`",
        "# heading so this stays empty",
        "- `piped`",
        "| not a description",
      ].join("\n"),
    );
    expect(fields.get("hp")?.description).toBe("points of the enemy. |");
    expect(fields.get("speedWu")?.description).toContain("world units");
    expect(fields.get("weight")?.description).toContain("knockback");
    expect(fields.get("skipped")?.description).toBe("");
    expect(fields.get("hashed")?.description).toBe("");
    expect(fields.get("piped")?.description).toBe("");
  });
});

describe("validateFieldDescription", () => {
  it("rejects placeholders, short copy, and accepts a full sentence", () => {
    expect(
      validateFieldDescription(
        { key: "hp", description: "TODO later on this", line: 3 },
        "enemies.json",
      ),
    ).toMatch(/placeholder/);
    expect(
      validateFieldDescription(
        { key: "hp", description: "too short", line: 3 },
        "enemies.json",
      ),
    ).toMatch(/too short/);
    expect(
      validateFieldDescription(
        {
          key: "hp",
          description: "Maximum hit points for this enemy row.",
          line: 3,
        },
        "enemies.json",
      ),
    ).toBeNull();
  });
});

describe("shippedJsonSectionFiles", () => {
  it("returns the shipped data file list", () => {
    expect(shippedJsonSectionFiles().length).toBeGreaterThan(0);
    expect(shippedJsonSectionFiles()).toContain("enemies.json");
  });
});
