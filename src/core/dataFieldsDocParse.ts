import { SHIPPED_DATA_JSON_FILES } from "./dataFieldsDocKeys";

/** Minimum non-placeholder description length per documented field. */
export const DATA_FIELDS_MIN_DESCRIPTION_CHARS = 15;

const PLACEHOLDER = /\b(TBD|TODO|FIXME|XXX)\b/i;

const TABLE_FIELD_ROW =
  /^\|\s*`([a-zA-Z][a-zA-Z0-9_]*)`\s*\|(.+)$/;

const BULLET_FIELD =
  /^-\s*`([a-zA-Z][a-zA-Z0-9_]*)`(?:\s*[-—:]\s*(.+))?$/;

export type DocumentedField = {
  key: string;
  description: string;
  line: number;
};

export function splitDataFieldsSections(doc: string): Map<string, string> {
  const lines = doc.split("\n");
  const sections = new Map<string, string>();
  let currentFile: string | null = null;
  let buffer: string[] = [];

  const flush = () => {
    if (currentFile) {
      sections.set(currentFile, buffer.join("\n"));
    }
    buffer = [];
  };

  for (const line of lines) {
    const heading = /^## ([a-z0-9_.-]+\.json)\s*$/.exec(line);
    if (heading) {
      flush();
      currentFile = heading[1]!;
      continue;
    }
    if (currentFile) {
      if (/^## /.test(line) && !heading) {
        flush();
        currentFile = null;
        continue;
      }
      buffer.push(line);
    }
  }
  flush();
  return sections;
}

function stripMarkdownNoise(text: string): string {
  return text
    .replace(/\*\*[^*]+\*\*/g, "")
    .replace(/`/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseDocumentedFields(
  sectionText: string,
): Map<string, DocumentedField> {
  const lines = sectionText.split("\n");
  const fields = new Map<string, DocumentedField>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const tableMatch = TABLE_FIELD_ROW.exec(line);
    if (tableMatch) {
      const key = tableMatch[1]!;
      const description = stripMarkdownNoise(tableMatch[2]!);
      fields.set(key, { key, description, line: i + 1 });
      continue;
    }

    const bulletMatch = BULLET_FIELD.exec(line);
    if (bulletMatch) {
      const key = bulletMatch[1]!;
      let description = bulletMatch[2]?.trim() ?? "";
      if (!description && i + 1 < lines.length) {
        const next = lines[i + 1]!.trim();
        if (next && !next.startsWith("-") && !next.startsWith("|") && !next.startsWith("#")) {
          description = next;
          i += 1;
        }
      }
      fields.set(key, {
        key,
        description: stripMarkdownNoise(description),
        line: i + 1,
      });
    }
  }

  return fields;
}

export function validateFieldDescription(
  field: DocumentedField,
  file: string,
): string | null {
  if (PLACEHOLDER.test(field.description)) {
    return `${file} \`${field.key}\` (line ${field.line}): placeholder description`;
  }
  if (field.description.length < DATA_FIELDS_MIN_DESCRIPTION_CHARS) {
    return `${file} \`${field.key}\` (line ${field.line}): description too short (${field.description.length} < ${DATA_FIELDS_MIN_DESCRIPTION_CHARS}) — add type/unit and meaning`;
  }
  return null;
}

export function shippedJsonSectionFiles(): readonly string[] {
  return SHIPPED_DATA_JSON_FILES;
}