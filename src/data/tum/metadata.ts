import {
  parseTumAccelerometer, parseTumGroundtruth, parseTumImageList,
  type TumAccelerometerRow, type TumGroundtruthRow, type TumImageRow,
  type TumParseResult, type TumSourceLocation, type TumTextIssue,
} from './text';
import type { FrameTime } from '../../shared/types';

export type TumTableKind = 'rgb' | 'depth' | 'groundtruth' | 'accelerometer';
export type TumTimeUnit = 'seconds' | 'unknown';
export interface TumTimestampDescription {
  unit: TumTimeUnit;
  origin: string;
  evidence: readonly string[];
  /** Documents source processing; this module does not apply or undo this correction. */
  sourceCorrection: string;
}
export interface TumColumnDescription {
  name: string;
  unit: 'seconds' | 'meters' | 'dimensionless' | 'unknown' | 'not-applicable';
  evidence: readonly string[];
}
export type TumOriginalRow = (TumImageRow | TumGroundtruthRow | TumAccelerometerRow) & {
  /** Unmodified physical source line, excluding its newline separator. */
  originalLine: string;
  /** Source tokens retain the formatting of all numbers, not just timestamps. */
  originalColumns: readonly string[];
};
export interface TumTimestampInput {
  file: string;
  lineNumber: number;
  sourceIndex: number;
  timestampRaw: string;
}
export interface TumTableScope {
  kind: 'source-table';
  file: string;
  tableKind: TumTableKind;
  selection: 'all-source-data-rows-in-original-order';
}
export interface TumDerived<T> {
  value: T;
  inputs: readonly TumTimestampInput[];
  method: string;
  unit: 'count' | 'seconds' | 'source-timestamp-unit-unknown';
  scope: TumTableScope;
}
export interface TumDerivedTime extends TumDerived<number | null> {
  /** Exact base-10 result where representable; no JSON-incompatible BigInt escapes. */
  exactDecimal: string | null;
  limitations: readonly string[];
}
export interface TumTableMetadata {
  original: {
    kind: TumTableKind;
    file: string;
    columns: readonly TumColumnDescription[];
    rows: readonly TumOriginalRow[];
    timestamp: TumTimestampDescription;
  };
  derived: {
    scope: TumTableScope;
    observedCount: TumDerived<number>;
    /** Consecutive source rows only. Negative/zero differences are preserved without classification. */
    intervals: readonly TumDerivedTime[];
    firstToLastDuration: TumDerivedTime;
    minimumInterval: TumDerivedTime;
    maximumInterval: TumDerivedTime;
    meanInterval: TumDerivedTime;
    medianInterval: TumDerivedTime;
  };
}
export type TumMetadataResult =
  | { ok: true; value: TumTableMetadata }
  | { ok: false; issues: readonly TumTextIssue[] };

const FORMATS = 'https://cvg.cit.tum.de/data/datasets/rgbd-dataset/file_formats';
const PAPER = 'https://cvg.cit.tum.de/_media/spezial/bib/sturm12iros.pdf';
const TOOLS = 'https://cvg.cit.tum.de/data/datasets/rgbd-dataset/tools#evaluation';
const LOCAL_EVIDENCE = 'docs/datasets.md — Gözlenen metadata ve yorumlama sınırları';

/** Each table has its own source description; an epoch from one table is never copied to another. */
export function getTumTimestampDescription(kind: TumTableKind): TumTimestampDescription {
  if (kind === 'groundtruth') return {
    unit: 'seconds',
    origin: 'Unix epoch seconds; TUM groundtruth zaman damgalarının belgelenmiş başlangıç noktası.',
    evidence: [FORMATS, PAPER, LOCAL_EVIDENCE],
    sourceCorrection: 'TUM yayını §VI-D referans yörünge damgalarına yaklaşık 20 ms düzeltme uygulandığını bildirir. Bu modül dosyadaki düzeltilmiş damgaları korur; düzeltme uygulamaz veya geri almaz.',
  };
  return {
    unit: 'unknown',
    origin: 'Başlangıç noktası ve kesin cihaz/pozlama saati bu akış için kaynak belgelerinde doğrulanmadı.',
    evidence: [LOCAL_EVIDENCE],
    sourceCorrection: kind === 'accelerometer'
      ? 'Bu modül ivmeölçer zamanına düzeltme, dönüşüm veya diğer akışlara hizalama uygulamaz.'
      : 'Kaynak damgaları değiştirilmez; yaklaşık 20 ms ortalama akış farkı tekil kare düzeltmesi değildir ve uygulanmaz.',
  };
}

/** A verified seconds unit is required; a clock origin may remain explicitly unknown. */
export function toTumFrameTime(row: TumSourceLocation, kind: TumTableKind, file: string): FrameTime {
  const description = getTumTimestampDescription(kind);
  // Inspect the mantissa, not exponent digits: 0e-400 is zero, 1e-400 underflows.
  // Keep the original token in table metadata instead of inventing an original zero time.
  const underflow = row.timestampValue === 0 && /[1-9]/u.test(row.timestampRaw.split(/[eE]/u, 1)[0]);
  if (description.unit !== 'seconds' || !Number.isFinite(row.timestampValue) || underflow) return { kind: 'unknown' };
  return {
    kind: 'original',
    seconds: row.timestampValue,
    timeBase: `TUM ${kind}; file=${file}; ${description.origin}`,
    source: `${file}, satır ${row.lineNumber}, kaynak indeksi ${row.sourceIndex}, özgün token ${row.timestampRaw}. ${description.sourceCorrection} ${description.evidence.join(' ; ')}`,
  };
}

function columnsFor(kind: TumTableKind, timestamp: TumTimestampDescription): TumColumnDescription[] {
  const column = (name: string, unit: TumColumnDescription['unit'], evidence: readonly string[]): TumColumnDescription => ({ name, unit, evidence });
  const first = column('timestamp', timestamp.unit, timestamp.evidence);
  if (kind === 'rgb' || kind === 'depth') return [first, column('filename', 'not-applicable', [FORMATS, LOCAL_EVIDENCE])];
  if (kind === 'groundtruth') return [
    first,
    ...['tx', 'ty', 'tz'].map(name => column(name, 'meters', [TOOLS, 'TUM değerlendirme araçlarında translasyon hatası metre cinsindedir; varsayılan scale=1 konum birimi bağlamını sağlar. TXT başlığında ayrı bir birim alanı bulunmaz.'])),
    ...['qx', 'qy', 'qz', 'qw'].map(name => column(name, 'dimensionless', [FORMATS])),
  ];
  return [first, ...['ax', 'ay', 'az'].map(name => column(name, 'unknown', [LOCAL_EVIDENCE]))];
}

// Decimal arithmetic is internal only. Bounds prevent adversarial exponents such as 1e-999999999.
const EXACT_LIMIT = 4096;
interface Decimal { coefficient: bigint; scale: number }
function normalise(decimal: Decimal): Decimal {
  let { coefficient, scale } = decimal;
  if (coefficient === 0n) return { coefficient: 0n, scale: 0 };
  while (coefficient % 10n === 0n) { coefficient /= 10n; --scale; }
  return { coefficient, scale };
}
function exactDecimal(raw: string): Decimal | undefined {
  if (raw.length > EXACT_LIMIT) return undefined;
  const match = /^([+-]?)(\d*(?:\.\d*)?)(?:[eE]([+-]?\d+))?$/u.exec(raw);
  if (!match) return undefined;
  const exponent = Number(match[3] ?? 0);
  if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > EXACT_LIMIT) return undefined;
  const [integer, fraction = ''] = match[2].split('.');
  const digits = integer + fraction;
  const scale = fraction.length - exponent;
  if (Math.abs(scale) > EXACT_LIMIT) return undefined;
  return normalise({ coefficient: BigInt(`${match[1] === '-' ? '-' : ''}${digits}`), scale });
}
function add(left: Decimal, right: Decimal, subtract = false): Decimal {
  const scale = Math.max(left.scale, right.scale);
  return normalise({
    coefficient: left.coefficient * 10n ** BigInt(scale - left.scale) +
      (subtract ? -1n : 1n) * right.coefficient * 10n ** BigInt(scale - right.scale),
    scale,
  });
}
function format(decimal: Decimal): string {
  const { coefficient, scale } = normalise(decimal);
  const sign = coefficient < 0n ? '-' : '';
  const digits = (coefficient < 0n ? -coefficient : coefficient).toString();
  if (scale <= 0) return `${sign}${digits}${'0'.repeat(-scale)}`;
  if (digits.length <= scale) return `${sign}0.${'0'.repeat(scale - digits.length)}${digits}`;
  return `${sign}${digits.slice(0, -scale)}.${digits.slice(-scale)}`;
}
function divide(decimal: Decimal, divisor: number): { exact?: Decimal; approximate: Decimal } {
  let numerator = decimal.coefficient;
  let denominator = BigInt(divisor);
  const gcd = (a: bigint, b: bigint): bigint => { while (b !== 0n) [a, b] = [b, a % b]; return a; };
  const common = gcd(numerator < 0n ? -numerator : numerator, denominator);
  numerator /= common; denominator /= common;
  let twos = 0; let fives = 0;
  while (denominator % 2n === 0n) { denominator /= 2n; ++twos; }
  while (denominator % 5n === 0n) { denominator /= 5n; ++fives; }
  if (denominator === 1n) {
    const places = Math.max(twos, fives);
    const exact = normalise({ coefficient: numerator * 2n ** BigInt(places - twos) * 5n ** BigInt(places - fives), scale: decimal.scale + places });
    return { exact, approximate: exact };
  }
  // Only the public Number is approximate. Non-terminating decimals have no fabricated exact string.
  return { approximate: normalise({ coefficient: decimal.coefficient * 10n ** 32n / BigInt(divisor), scale: decimal.scale + 32 }) };
}

/**
 * Independent per-table provenance and timing summary. Does not align streams,
 * infer FPS/clock origins, classify gaps, normalise quaternions or convert units.
 */
export function describeTumTable(text: string, kind: TumTableKind, file: string): TumMetadataResult {
  const parsed: TumParseResult<TumImageRow | TumGroundtruthRow | TumAccelerometerRow> =
    kind === 'rgb' || kind === 'depth' ? parseTumImageList(text, kind) :
      kind === 'groundtruth' ? parseTumGroundtruth(text) : parseTumAccelerometer(text);
  if (!parsed.ok) return parsed;
  const physicalLines = text.split(/\r\n|\n|\r/u);
  const rows: TumOriginalRow[] = parsed.rows.map(row => ({
    ...row,
    originalLine: physicalLines[row.lineNumber - 1],
    originalColumns: physicalLines[row.lineNumber - 1].trim().split(/\s+/u),
  }));
  const timestamp = getTumTimestampDescription(kind);
  const scope: TumTableScope = { kind: 'source-table', file, tableKind: kind, selection: 'all-source-data-rows-in-original-order' };
  const inputFor = (row: TumSourceLocation): TumTimestampInput => ({ file, lineNumber: row.lineNumber, sourceIndex: row.sourceIndex, timestampRaw: row.timestampRaw });
  const inputs = rows.map(inputFor);
  const unit = timestamp.unit === 'seconds' ? 'seconds' : 'source-timestamp-unit-unknown';
  const decimalRows = rows.map(row => exactDecimal(row.timestampRaw));
  const limitations = timestamp.unit === 'unknown' ? ['Kaynak zaman birimi doğrulanmadı; bu sonuç saniye veya ortak zaman tabanı olarak yorumlanamaz.'] : [];
  const derived = (
    decimal: Decimal | undefined,
    usedInputs: readonly TumTimestampInput[],
    method: string,
    unavailable?: string,
    divisor = 1,
  ): TumDerivedTime => {
    const result = decimal === undefined ? undefined : divide(decimal, divisor);
    const numeric = result === undefined ? null : Number(format(result.approximate));
    const underflow = numeric === 0 && result !== undefined && result.approximate.coefficient !== 0n;
    return {
      value: numeric !== null && Number.isFinite(numeric) && !underflow ? numeric : null,
      exactDecimal: result?.exact === undefined ? null : format(result.exact),
      inputs: usedInputs, method, unit, scope,
      limitations: [
        ...limitations,
        ...(unavailable ? [unavailable] : []),
        ...(decimal === undefined && !unavailable ? ['Tam ondalık işlem sınırı aşıldı: token/üs için 4096 basamak sınırı; yaklaşık sıfır veya uydurma fark üretilmedi.'] : []),
        ...(numeric !== null && !Number.isFinite(numeric) ? ['Sonuç sonlu JavaScript Number aralığı dışında; exactDecimal korunur.'] : []),
        ...(underflow ? ['Sıfır olmayan sonuç JavaScript Number gösteriminde sıfıra yuvarlanır; value null, exactDecimal korunur.'] : []),
        ...(result && !result.exact ? ['Ortalamanın ondalık açılımı sonlanmaz; value yaklaşık Number değeridir, exactDecimal null bırakıldı.'] : []),
      ],
    };
  };
  const decimalIntervals = decimalRows.slice(1).map((current, index) => current === undefined || decimalRows[index] === undefined ? undefined : add(current, decimalRows[index]!, true));
  const intervals = decimalIntervals.map((value, index) => derived(value, inputs.slice(index, index + 2), 'Özgün dosya sırasındaki ardışık iki timestampRaw tokeni arasında tam ondalık çıkarma: sonraki − önceki. value, ondalık sonucun Number gösterimidir.'));
  const missing = rows.length < 2 ? 'En az iki veri satırı gerekir; boş veya tek satırlı tablodan süre/aralık istatistiği üretilmez.' : undefined;
  const completeIntervals = decimalIntervals.every((value): value is Decimal => value !== undefined) && decimalIntervals.length > 0 ? decimalIntervals as Decimal[] : undefined;
  const sorted = completeIntervals?.slice().sort((a, b) => {
    const difference = add(a, b, true).coefficient;
    return difference < 0n ? -1 : difference > 0n ? 1 : 0;
  });
  const sum = completeIntervals?.reduce((total, value) => add(total, value), { coefficient: 0n, scale: 0 });
  const medianIndex = sorted === undefined ? 0 : Math.floor(sorted.length / 2);
  const median = sorted === undefined ? undefined : sorted.length % 2 === 1 ? sorted[medianIndex] : add(sorted[medianIndex - 1], sorted[medianIndex]);
  const duration = rows.length < 2 || decimalRows[0] === undefined || decimalRows.at(-1) === undefined ? undefined : add(decimalRows.at(-1)!, decimalRows[0], true);
  return {
    ok: true,
    value: {
      original: { kind, file, columns: columnsFor(kind, timestamp), rows, timestamp },
      derived: {
        scope,
        observedCount: { value: rows.length, inputs, unit: 'count', scope, method: 'Yorum ve boş satırlar hariç, tamamen başarılı ayrıştırılmış özgün veri satırlarının sayısı; PNG varlığından bağımsız.' },
        intervals,
        firstToLastDuration: derived(duration, rows.length < 2 ? inputs : [inputs[0], inputs.at(-1)!], 'Özgün dosya sırasındaki son timestampRaw − ilk timestampRaw; min/max zaman veya oturum süresi varsayılmaz.', missing),
        minimumInterval: derived(sorted?.[0], inputs, 'Özgün sıradaki ardışık zaman farklarının tam ondalık karşılaştırmayla minimumu; sıfır/negatif farklar dahil.', missing),
        maximumInterval: derived(sorted?.at(-1), inputs, 'Özgün sıradaki ardışık zaman farklarının tam ondalık karşılaştırmayla maksimumu; sıfır/negatif farklar dahil.', missing),
        meanInterval: derived(sum, inputs, 'Özgün sıradaki ardışık zaman farklarının tam ondalık toplamı / aralık sayısı; value Number gösterimidir.', missing, completeIntervals?.length ?? 1),
        medianInterval: derived(median, inputs, 'Yalnız fark değerlerinin sıralanmış kopyasında medyan; çift sayıda farkta iki orta değerin aritmetik ortalaması. Özgün satırlar sıralanmaz.', missing, sorted && sorted.length % 2 === 0 ? 2 : 1),
      },
    },
  };
}
