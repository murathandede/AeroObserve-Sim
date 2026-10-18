import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  isSafeRelativePath,
  parseTumAccelerometer,
  parseTumGroundtruth,
  parseTumImageList,
} from '../src/data/tum/text';

test('YAPAY TXT: yorum/boş satır, CRLF, kaynak sırası ve özgün zaman tokeni korunur', () => {
  const parsed = parseTumImageList('# timestamp filename\r\n \r\n  002.5000 rgb/second.png\r\n\t# comment\r\n-1e-2\trgb/first.png\r\n002.5000 rgb/repeated-time.png\r\n', 'rgb');
  assert.ok(parsed.ok);
  assert.deepEqual(parsed.rows, [
    { lineNumber: 3, sourceIndex: 0, timestampRaw: '002.5000', timestampValue: 2.5, path: 'rgb/second.png' },
    { lineNumber: 5, sourceIndex: 1, timestampRaw: '-1e-2', timestampValue: -0.01, path: 'rgb/first.png' },
    { lineNumber: 6, sourceIndex: 2, timestampRaw: '002.5000', timestampValue: 2.5, path: 'rgb/repeated-time.png' },
  ]);
});

test('YAPAY TXT: hatalı satırlar tümüyle raporlanır, kısmi başarı/sessiz düzeltme yoktur', () => {
  const parsed = parseTumImageList('# comment\n1 rgb/a.png\n\nNaN rgb/b.png\n2 rgb/a.png\n3 rgb/c.png extra\nInfinity rgb/d.png\n0x10 rgb/e.png\n1e999 rgb/f.png\n4 depth/wrong.png\n5 rgb/inline.png # comment', 'rgb');
  assert.equal(parsed.ok, false);
  if (parsed.ok) return;
  assert.equal('rows' in parsed, false);
  assert.deepEqual(parsed.issues.map(issue => [issue.lineNumber, issue.sourceIndex]), [
    [4, 1], [5, 2], [6, 3], [7, 4], [8, 5], [9, 6], [10, 7], [11, 8],
  ]);
  assert.match(parsed.issues[1].message, /ilk kullanım 2/);
});

test('YAPAY TXT: dosya yolları güvenlidir; mutlak/URL/traversal/escape yolları reddedilir', () => {
  for (const path of [
    '/rgb/a.png', '../rgb/a.png', 'rgb/../a.png', 'rgb/./a.png', 'rgb//a.png',
    'C:/rgb/a.png', 'rgb\\a.png', 'https://example.org/a.png', 'rgb/a.png?x',
    'rgb/a.png#x', 'rgb/%2e%2e/a.png', 'rgb/%252e%252e/a.png', 'rgb/a\u0000.png',
  ]) {
    assert.equal(isSafeRelativePath(path), false, path);
    assert.equal(parseTumImageList(`1 ${path}`, 'rgb').ok, false, path);
  }
  assert.equal(isSafeRelativePath('rgb/a.png'), true);
  assert.equal(parseTumImageList('1 rgb/a.jpg', 'rgb').ok, false);
  assert.equal(parseTumImageList('1 rgb/a.png', 'depth').ok, false);
});

test('YAPAY TXT: groundtruth ve accelerometer sütunları görüntüye dönüştürülmeden ayrıştırılır', () => {
  const groundtruth = parseTumGroundtruth('# timestamp tx ty tz qx qy qz qw\n1305031452.500000 1 -2 .3 0 0 0 1');
  assert.ok(groundtruth.ok);
  assert.deepEqual(groundtruth.rows, [{
    lineNumber: 2, sourceIndex: 0, timestampRaw: '1305031452.500000', timestampValue: 1305031452.5,
    translation: [1, -2, 0.3], rotation: [0, 0, 0, 1],
  }]);
  const accel = parseTumAccelerometer('# timestamp ax ay az\n1.000 +1.2 -.5 0e2');
  assert.ok(accel.ok);
  assert.deepEqual(accel.rows[0].acceleration, [1.2, -0.5, 0]);
  assert.equal(accel.rows[0].timestampRaw, '1.000');
  for (const text of ['1 2 3', '1 2 3 4 5', 'NaN 1 2 3', '1 0x10 2 3', '1 1 Infinity 3']) {
    assert.equal(parseTumAccelerometer(text).ok, false, text);
  }
  assert.equal(parseTumGroundtruth('1 2 3 4 5 6 7').ok, false);
  assert.equal(parseTumGroundtruth('1 2 3 4 5 6 7 Infinity').ok, false);
});

test('YAPAY TXT: boş veya yalnız yorum içeren tablo sıfır satırlı geçerli tablodur', () => {
  assert.deepEqual(parseTumImageList(' \n# comment\n', 'depth'), { ok: true, rows: [] });
  assert.deepEqual(parseTumGroundtruth(''), { ok: true, rows: [] });
  assert.deepEqual(parseTumAccelerometer('# comment\r'), { ok: true, rows: [] });
});

test('GERÇEK TUM örneği: dört özgün TXT ve tam kaynak indeksleri', async (context) => {
  const root = new URL('../data/local/tum-rgbd-freiburg1-desk/rgbd_dataset_freiburg1_desk/', import.meta.url);
  let text: string[];
  try {
    text = await Promise.all(['rgb.txt', 'depth.txt', 'groundtruth.txt', 'accelerometer.txt'].map(name => readFile(new URL(name, root), 'utf8')));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      context.skip('Gerçek yerel örnek bulunamadı; edinme adımları docs/datasets.md içinde. Yapay veriler gerçek dosya yerine kullanılmaz.');
      return;
    }
    throw error;
  }
  const rgb = parseTumImageList(text[0], 'rgb');
  const depth = parseTumImageList(text[1], 'depth');
  const groundtruth = parseTumGroundtruth(text[2]);
  const accel = parseTumAccelerometer(text[3]);
  assert.ok(rgb.ok); assert.ok(depth.ok); assert.ok(groundtruth.ok); assert.ok(accel.ok);
  assert.deepEqual([rgb.rows.length, depth.rows.length, groundtruth.rows.length, accel.rows.length], [613, 595, 2335, 11815]);
  assert.deepEqual([0, 306, 612].map(index => rgb.rows[index].path), [
    'rgb/1305031452.791720.png', 'rgb/1305031462.995550.png', 'rgb/1305031473.196069.png',
  ]);
  assert.deepEqual([0, 297, 594].map(index => depth.rows[index].path), [
    'depth/1305031453.374112.png', 'depth/1305031463.278737.png', 'depth/1305031473.190828.png',
  ]);
  assert.equal(rgb.rows[0].timestampRaw, '1305031452.791720');
  assert.equal(depth.rows[0].timestampRaw, '1305031453.374112');
  assert.equal(rgb.rows.at(-1)?.sourceIndex, 612);
  assert.equal(depth.rows.at(-1)?.sourceIndex, 594);
});
