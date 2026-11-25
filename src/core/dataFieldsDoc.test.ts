import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BOOT_DOCUMENTED_KEYS_BY_FILE } from "./dataFieldsDocSpec";
import {
  parseDocumentedFields,
  shippedJsonSectionFiles,
  splitDataFieldsSections,
  validateFieldDescription,
} from "./dataFieldsDocParse";

const DOC_PATH = path.join(process.cwd(), "docs/DATA_FIELDS.md");

function loadDataFieldsDoc(): string {
  return readFileSync(DOC_PATH, "utf8");
}

describe("DATA_FIELDS.md", () => {
  const doc = loadDataFieldsDoc();
  const sections = splitDataFieldsSections(doc);

  it("documents workflow and field entry format in intro", () => {
    expect(doc).toMatch(/bidirectional/i);
    expect(doc).toMatch(/dataFieldsDoc\.test\.ts/i);
    expect(doc).toMatch(/normalize\*/i);
    expect(doc).toMatch(/- `autoAttackMeleeRange` —/);
  });

  it("links TypeScript modules in each shipped json section", () => {
    for (const file of shippedJsonSectionFiles()) {
      const section = sections.get(file);
      expect(section, `missing ## ${file}`).toBeDefined();
      expect(
        section,
        `${file}: add **TypeScript:** line with ../src/ links`,
      ).toMatch(/\]\(\.\.\/src\//);
    }
  });

  it("has one section per shipped json file", () => {
    for (const file of shippedJsonSectionFiles()) {
      expect(sections.has(file), `missing ## ${file}`).toBe(true);
    }
    for (const key of sections.keys()) {
      expect(
        (shippedJsonSectionFiles() as readonly string[]).includes(key),
        `unexpected section ${key}`,
      ).toBe(true);
    }
  });

  it.each(
    Object.entries(BOOT_DOCUMENTED_KEYS_BY_FILE).map(
      ([file, keys]) => [file, keys] as const,
    ),
  )("bidirectional boot parity for %s", (file, expectedKeys) => {
    const section = sections.get(file);
    expect(section, `no section for ${file}`).toBeDefined();
    const documented = parseDocumentedFields(section!);
    const expectedSet = new Set(expectedKeys);
    const documentedKeys = new Set(documented.keys());

    const missing = expectedKeys.filter((k) => !documentedKeys.has(k));
    const extra = [...documentedKeys].filter((k) => !expectedSet.has(k));

    expect(missing, `${file}: add documented entries for boot keys`).toEqual(
      [],
    );
    expect(
      extra,
      `${file}: remove stale entries or update dataFieldsDocSpec / normalize*`,
    ).toEqual([]);
  });

  it.each(
    Object.entries(BOOT_DOCUMENTED_KEYS_BY_FILE).map(
      ([file, keys]) => [file, keys] as const,
    ),
  )(
    "each boot field in %s has a substantive description",
    (file, expectedKeys) => {
      const section = sections.get(file)!;
      const documented = parseDocumentedFields(section);
      for (const key of expectedKeys) {
        const field = documented.get(key);
        expect(field, `${file}: no parsed entry for \`${key}\``).toBeDefined();
        const problem = validateFieldDescription(field!, file);
        expect(problem, problem ?? "").toBeNull();
      }
    },
  );
});
