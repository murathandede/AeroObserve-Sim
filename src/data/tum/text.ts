/** The TXT tables retain source order; this module never pairs RGB and depth rows. */
export type TumStream = 'rgb' | 'depth';

export interface TumSourceLocation {
  /** One-based physical line number, including comment and empty lines. */
  lineNumber: number;
  /** Zero-based ordinal among source data lines, including malformed data lines. */
  sourceIndex: number;
  /** Original token. The number representation can lose decimal precision. */
  timestampRaw: string;
  timestampValue: number;
}

export interface TumImageRow extends TumSourceLocation { path: string }
export interface TumGroundtruthRow extends TumSourceLocation {
  translation: readonly [number, number, number];
  rotation: readonly [number, number, number, number];
}
export interface TumAccelerometerRow extends TumSourceLocation {
  /** The source's acceleration unit is not established; no conversion is applied. */
  acceleration: readonly [number, number, number];
}
export interface TumTextIssue { lineNumber: number; sourceIndex: number; message: string }
export type TumParseResult<T> =
  | { ok: true; rows: readonly T[] }
  | { ok: false; issues: readonly TumTextIssue[] };

// Deliberately excludes Number() extensions such as hexadecimal, NaN and Infinity.
const decimal = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

/**
 * Blob-map keys must be literal relative paths, not URLs or encoded aliases.
 * Percent escapes are rejected rather than decoded/normalised silently.
 */
export function isSafeRelativePath(path: string): boolean {
  if (typeof path !== 'string' || path.length === 0 || /[\\:%?#\u0000-\u0020\u007f]/u.test(path)) return false;
  return path.split('/').every(segment => segment.length > 0 && segment !== '.' && segment !== '..');
}

interface SourceLine {
  lineNumber: number;
  sourceIndex: number;
  columns: readonly string[];
}

function parseTable<T>(
  text: string,
  expectedColumns: number,
  parse: (line: SourceLine, issues: TumTextIssue[]) => T | undefined,
): TumParseResult<T> {
  const rows: T[] = [];
  const issues: TumTextIssue[] = [];
  let sourceIndex = 0;
  // A trailing newline creates an empty line and is harmless. CRLF and CR are accepted.
  for (const [lineIndex, physicalLine] of text.split(/\r\n|\n|\r/u).entries()) {
    const line = physicalLine.trim();
    if (line.length === 0 || line.startsWith('#')) continue;
    const location = { lineNumber: lineIndex + 1, sourceIndex: sourceIndex++ };
    const columns = line.split(/\s+/u);
    if (columns.length !== expectedColumns) {
      issues.push({ ...location, message: `Beklenen sütun sayısı ${expectedColumns}; bulunan ${columns.length}.` });
      continue;
    }
    const row = parse({ ...location, columns }, issues);
    if (row !== undefined) rows.push(row);
  }
  // Do not expose valid partial output as if the entire table had parsed correctly.
  return issues.length > 0 ? { ok: false, issues } : { ok: true, rows };
}

function parseNumbers(line: SourceLine, count: number, issues: TumTextIssue[]): number[] | undefined {
  const values: number[] = [];
  let valid = true;
  for (let index = 0; index < count; index++) {
    const token = line.columns[index];
    const value = Number(token);
    if (!decimal.test(token) || !Number.isFinite(value)) {
      issues.push({ lineNumber: line.lineNumber, sourceIndex: line.sourceIndex, message: `${index + 1}. sütun sonlu ondalık sayı olmalı; bulunan “${token}”.` });
      valid = false;
    }
    values.push(value);
  }
  return valid ? values : undefined;
}

function sourceLocation(line: SourceLine, timestampValue: number): TumSourceLocation {
  return {
    lineNumber: line.lineNumber,
    sourceIndex: line.sourceIndex,
    timestampRaw: line.columns[0],
    timestampValue,
  };
}

/** Timestamp and path, as documented for rgb.txt/depth.txt. Inline comments are rejected as extra columns. */
export function parseTumImageList(text: string, stream: TumStream): TumParseResult<TumImageRow> {
  const seenPaths = new Map<string, number>();
  return parseTable(text, 2, (line, issues) => {
    const numbers = parseNumbers(line, 1, issues);
    const path = line.columns[1];
    const initialIssueCount = issues.length;
    if (!isSafeRelativePath(path) || !path.startsWith(`${stream}/`) || !path.endsWith('.png')) {
      issues.push({ lineNumber: line.lineNumber, sourceIndex: line.sourceIndex, message: `Görüntü yolu güvenli, göreli bir ${stream}/… .png yolu olmalı; bulunan “${path}”.` });
    } else {
      const firstLine = seenPaths.get(path);
      if (firstLine !== undefined) {
        issues.push({ lineNumber: line.lineNumber, sourceIndex: line.sourceIndex, message: `Görüntü yolu tekrarlanıyor; ilk kullanım ${firstLine}. satır: “${path}”.` });
      } else seenPaths.set(path, line.lineNumber);
    }
    if (numbers === undefined || issues.length !== initialIssueCount) return undefined;
    return { ...sourceLocation(line, numbers[0]), path };
  });
}

/** timestamp tx ty tz qx qy qz qw; coordinates and quaternion remain unmodified. */
export function parseTumGroundtruth(text: string): TumParseResult<TumGroundtruthRow> {
  return parseTable(text, 8, (line, issues) => {
    const values = parseNumbers(line, 8, issues);
    if (values === undefined) return undefined;
    return {
      ...sourceLocation(line, values[0]),
      translation: [values[1], values[2], values[3]],
      rotation: [values[4], values[5], values[6], values[7]],
    };
  });
}

/** timestamp ax ay az. No time-base alignment or acceleration-unit inference occurs. */
export function parseTumAccelerometer(text: string): TumParseResult<TumAccelerometerRow> {
  return parseTable(text, 4, (line, issues) => {
    const values = parseNumbers(line, 4, issues);
    if (values === undefined) return undefined;
    return {
      ...sourceLocation(line, values[0]),
      acceleration: [values[1], values[2], values[3]],
    };
  });
}
