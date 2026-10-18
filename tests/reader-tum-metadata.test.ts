import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describeTumTable, getTumTimestampDescription, toTumFrameTime, type TumTableKind } from '../src/data/tum/metadata';

function metadata(text: string, kind: TumTableKind = 'rgb') {
  const result = describeTumTable(text, kind, `yapay/${kind}.txt`);
  assert.ok(result.ok);
  return result.value;
}

test('YAPAY METADATA: özgün tüm sütun tokenleri, satır ve sıra indeksleri kayıpsız korunur', () => {
  const source = '# timestamp tx ty tz qx qy qz qw\r\n\r\n  1305031452.500000 1.000 -2e0 .300 0.0 0 0 +1 \r\n';
  const value = metadata(source, 'groundtruth');
  assert.equal(value.original.file, 'yapay/groundtruth.txt');
  assert.equal(value.original.kind, 'groundtruth');
  assert.deepEqual(value.original.columns.map(column => column.name), ['timestamp', 'tx', 'ty', 'tz', 'qx', 'qy', 'qz', 'qw']);
  assert.deepEqual(value.original.columns.map(column => column.unit), ['seconds', 'meters', 'meters', 'meters', 'dimensionless', 'dimensionless', 'dimensionless', 'dimensionless']);
  assert.deepEqual(value.original.rows[0].originalColumns, ['1305031452.500000', '1.000', '-2e0', '.300', '0.0', '0', '0', '+1']);
  assert.equal(value.original.rows[0].originalLine, '  1305031452.500000 1.000 -2e0 .300 0.0 0 0 +1 ');
  assert.equal(value.original.rows[0].lineNumber, 3); assert.equal(value.original.rows[0].sourceIndex, 0);
  assert.equal(value.original.rows[0].timestampRaw, '1305031452.500000');
  assert.match(value.original.timestamp.origin, /Unix epoch/);
  assert.match(value.original.timestamp.sourceCorrection, /20 ms/);
  assert.match(value.original.timestamp.sourceCorrection, /uygulamaz veya geri almaz/);
});

test('YAPAY METADATA: ardışık farklar büyük epoch sayılarının Number çıkarma hatasını taşımaz', () => {
  const value = metadata('1305031452.791720 rgb/a.png\n1305031452.791721 rgb/b.png\n1305031452.791723 rgb/c.png\n');
  assert.deepEqual(value.derived.intervals.map(interval => interval.exactDecimal), ['0.000001', '0.000002']);
  assert.deepEqual(value.derived.intervals.map(interval => interval.value), [0.000001, 0.000002]);
  assert.equal(value.derived.firstToLastDuration.exactDecimal, '0.000003');
  assert.equal(value.derived.minimumInterval.exactDecimal, '0.000001');
  assert.equal(value.derived.maximumInterval.exactDecimal, '0.000002');
  assert.equal(value.derived.meanInterval.exactDecimal, '0.0000015');
  assert.equal(value.derived.medianInterval.exactDecimal, '0.0000015');
  for (const result of [value.derived.firstToLastDuration, value.derived.meanInterval, ...value.derived.intervals]) {
    assert.equal(result.unit, 'source-timestamp-unit-unknown');
    assert.equal(result.scope.selection, 'all-source-data-rows-in-original-order');
    assert.equal(result.scope.tableKind, 'rgb'); assert.equal(result.scope.file, 'yapay/rgb.txt');
    assert.ok(result.inputs.length >= 2); assert.ok(result.method.length > 0);
    assert.ok(result.inputs.every(input => input.file === 'yapay/rgb.txt' && input.timestampRaw.length > 0 && input.lineNumber > 0));
    assert.match(result.limitations.join(' '), /birimi doğrulanmadı/);
  }
  assert.equal(value.derived.observedCount.value, 3);
  assert.equal(value.derived.observedCount.unit, 'count');
  assert.deepEqual(value.derived.intervals[0].inputs.map(input => input.sourceIndex), [0, 1]);
  assert.equal(JSON.parse(JSON.stringify(value)).derived.firstToLastDuration.exactDecimal, '0.000003');
});

test('YAPAY METADATA: sıfır ve negatif aralık korunur; kaynak seri sıralanmaz veya akış eşlenmez', () => {
  const value = metadata('10 depth/a.png\n10 depth/b.png\n7 depth/c.png\n9 depth/d.png', 'depth');
  assert.deepEqual(value.original.rows.map(row => row.timestampRaw), ['10', '10', '7', '9']);
  assert.deepEqual(value.original.rows.map(row => row.sourceIndex), [0, 1, 2, 3]);
  assert.deepEqual(value.derived.intervals.map(interval => interval.exactDecimal), ['0', '-3', '2']);
  assert.equal(value.derived.firstToLastDuration.exactDecimal, '-1');
  assert.equal(value.derived.minimumInterval.exactDecimal, '-3');
  assert.equal(value.derived.maximumInterval.exactDecimal, '2');
  assert.equal(value.derived.medianInterval.exactDecimal, '0');
  assert.equal(value.derived.meanInterval.exactDecimal, null);
  assert.equal(value.derived.meanInterval.value, -1 / 3);
  assert.match(value.derived.meanInterval.limitations.join(' '), /sonlanmaz/);
});

test('YAPAY METADATA: boş/tek satırda tanımsız süre ve istatistikler null kalır', () => {
  for (const source of ['# comment\n\n', '1 rgb/only.png\n']) {
    const value = metadata(source);
    assert.equal(value.derived.observedCount.value, source.includes('only.png') ? 1 : 0);
    assert.deepEqual(value.derived.intervals, []);
    for (const result of [value.derived.firstToLastDuration, value.derived.minimumInterval, value.derived.maximumInterval, value.derived.meanInterval, value.derived.medianInterval]) {
      assert.equal(result.value, null); assert.equal(result.exactDecimal, null);
      assert.match(result.limitations.join(' '), /En az iki/);
      assert.ok(result.method.length > 0);
    }
  }
});

test('YAPAY METADATA: hatalı timestamp veya sütun kısmi metadata üretmez', () => {
  for (const source of ['1 rgb/a.png\nNaN rgb/b.png', '1 rgb/a.png\nInfinity rgb/b.png', '1 rgb/a.png\n2 rgb/b.png extra']) {
    const parsed = describeTumTable(source, 'rgb', 'yapay/rgb.txt');
    assert.equal(parsed.ok, false); assert.equal('value' in parsed, false);
    if (!parsed.ok) { assert.equal(parsed.issues[0].lineNumber, 2); assert.equal(parsed.issues[0].sourceIndex, 1); }
  }
});

test('YAPAY METADATA: birim/köken belirsizliği korunur; yalnız belgeli groundtruth v1 original olur', () => {
  for (const kind of ['rgb', 'depth', 'accelerometer'] as const) {
    assert.equal(getTumTimestampDescription(kind).unit, 'unknown');
    assert.match(getTumTimestampDescription(kind).origin, /doğrulanmadı/);
    const row = { lineNumber: 4, sourceIndex: 0, timestampRaw: '1305031452.123456', timestampValue: 1305031452.123456 };
    assert.deepEqual(toTumFrameTime(row, kind, `${kind}.txt`), { kind: 'unknown' });
  }
  const accel = metadata('1 2 3 4\n2 4 5 6', 'accelerometer');
  assert.deepEqual(accel.original.columns.map(column => column.unit), ['unknown', 'unknown', 'unknown', 'unknown']);
  const groundtruth = metadata('1305031452.500000 0 0 0 0 0 0 1\n1305031452.501000 1 2 3 0 0 0 1', 'groundtruth');
  assert.equal(groundtruth.derived.firstToLastDuration.unit, 'seconds');
  const time = toTumFrameTime(groundtruth.original.rows[0], 'groundtruth', groundtruth.original.file);
  assert.equal(time.kind, 'original');
  if (time.kind === 'original') {
    assert.equal(time.seconds, 1305031452.5);
    assert.match(time.timeBase, /Unix epoch seconds/); assert.match(time.timeBase, /yapay\/groundtruth.txt/);
    assert.match(time.source, /satır 1/); assert.match(time.source, /20 ms/);
  }
});

test('YAPAY METADATA: aşırı üs ve sonlu Number dışı farklar dürüstçe sınırlandırılır', () => {
  const extreme = metadata('1e-999999999 rgb/a.png\n2e-999999999 rgb/b.png');
  assert.equal(extreme.derived.intervals[0].value, null);
  assert.equal(extreme.derived.intervals[0].exactDecimal, null);
  assert.match(extreme.derived.intervals[0].limitations.join(' '), /4096/);
  const overflowing = metadata('-1e308 rgb/a.png\n1e308 rgb/b.png');
  assert.equal(overflowing.derived.intervals[0].value, null);
  assert.equal(overflowing.derived.intervals[0].exactDecimal, `2${'0'.repeat(308)}`);
  assert.match(overflowing.derived.intervals[0].limitations.join(' '), /Number aralığı dışında/);
  const underflowing = metadata('1e-1000 rgb/a.png\n2e-1000 rgb/b.png');
  assert.equal(underflowing.derived.intervals[0].value, null);
  assert.equal(underflowing.derived.intervals[0].exactDecimal, `0.${'0'.repeat(999)}1`);
  assert.match(underflowing.derived.intervals[0].limitations.join(' '), /sıfıra yuvarlanır/);
});

test('YAPAY METADATA: sıfıra underflow eden özgün zaman v1 original sıfırı olarak sunulmaz', () => {
  const tokens = ['1e-400', '-1e-400', '0e-400', '-0.0000e300', '+0e10', '5e-324'];
  const value = metadata(tokens.map(token => `${token} 0 0 0 0 0 0 1`).join('\n'), 'groundtruth');
  assert.deepEqual(value.original.rows.map(row => row.timestampRaw), tokens);
  for (const index of [0, 1]) {
    const row = value.original.rows[index];
    assert.equal(Math.abs(row.timestampValue), 0);
    assert.deepEqual(toTumFrameTime(row, 'groundtruth', value.original.file), { kind: 'unknown' });
    assert.equal(row.originalColumns[0], tokens[index]);
  }
  // A genuine source zero remains valid, and the smallest positive Number is not underflow.
  for (const index of [2, 3, 4, 5]) {
    const row = value.original.rows[index];
    const projected = toTumFrameTime(row, 'groundtruth', value.original.file);
    assert.equal(projected.kind, 'original');
    if (projected.kind === 'original') {
      assert.equal(projected.seconds, row.timestampValue);
      assert.ok(projected.source.includes(tokens[index]));
    }
  }
});

test('GERÇEK METADATA: dört özgün TXT sayısı, süre ve groundtruth zaman izi', async context => {
  const root = new URL('../data/local/tum-rgbd-freiburg1-desk/rgbd_dataset_freiburg1_desk/', import.meta.url);
  const expected: ReadonlyArray<[TumTableKind, number, string]> = [
    ['rgb', 613, '20.404349'], ['depth', 595, '19.816716'],
    ['groundtruth', 2335, '23.3995'], ['accelerometer', 11815, '23.656109'],
  ];
  const sources: string[] = [];
  for (const [kind] of expected) {
    try { sources.push(await readFile(new URL(`${kind}.txt`, root), 'utf8')); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      context.skip(`Gerçek ${kind}.txt bulunamadı; edinme adımları docs/datasets.md içinde. Gerçek veri doğrulaması tamamlanmadı.`);
      return;
    }
  }
  for (const [[kind, count, duration], index] of expected.map((entry, index) => [entry, index] as const)) {
    const described = describeTumTable(sources[index], kind, `rgbd_dataset_freiburg1_desk/${kind}.txt`);
    assert.ok(described.ok);
    const value = described.value;
    assert.equal(value.original.rows.length, count);
    assert.equal(value.derived.observedCount.value, count);
    assert.equal(value.derived.intervals.length, count - 1);
    assert.equal(value.derived.firstToLastDuration.exactDecimal, duration);
    assert.equal(value.original.rows[0].lineNumber, 4);
    assert.equal(value.original.rows.at(-1)?.sourceIndex, count - 1);
    assert.equal(value.original.timestamp.unit, kind === 'groundtruth' ? 'seconds' : 'unknown');
    const time = toTumFrameTime(value.original.rows[0], kind, value.original.file);
    assert.equal(time.kind, kind === 'groundtruth' ? 'original' : 'unknown');
    if (time.kind === 'original') assert.equal(time.seconds, Number(value.original.rows[0].timestampRaw));
    assert.doesNotThrow(() => JSON.stringify(value));
  }
});
