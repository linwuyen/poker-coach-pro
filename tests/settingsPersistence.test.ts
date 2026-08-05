import assert from 'node:assert/strict';
import test from 'node:test';

import {
  aiModeCodec,
  booleanCodec,
  enumCodec,
  jsonCodec,
  numberCodec,
  sessionSizeCodec,
  stringArrayCodec,
  tableSizeCodec,
  volumeCodec,
} from '../src/features/settings/persistence';

test('boolean persistence is deterministic', () => {
  assert.equal(booleanCodec.parse('true'), true);
  assert.equal(booleanCodec.parse('false'), false);
  assert.equal(booleanCodec.serialize(true), 'true');
});

test('enum codecs reject unknown values', () => {
  assert.equal(aiModeCodec.parse('online'), 'online');
  assert.equal(aiModeCodec.parse('invalid'), 'offline');
  assert.equal(tableSizeCodec.parse('6max'), '6max');
  assert.equal(tableSizeCodec.parse('heads-up'), '9max');

  const codec = enumCodec(['a', 'b'] as const, 'a');
  assert.equal(codec.parse('b'), 'b');
  assert.equal(codec.parse('c'), 'a');
});

test('session size preserves supported storage values', () => {
  assert.equal(sessionSizeCodec.parse('10'), 10);
  assert.equal(sessionSizeCodec.parse('20'), 20);
  assert.equal(sessionSizeCodec.parse('all'), 'all');
  assert.equal(sessionSizeCodec.parse('invalid'), 20);
});

test('number codecs reject NaN and out-of-range settings', () => {
  const codec = numberCodec(3, 0, 5);
  assert.equal(codec.parse('4'), 4);
  assert.equal(codec.parse('NaN'), 3);
  assert.equal(codec.parse('9'), 3);
  assert.equal(volumeCodec.parse('0.75'), 0.75);
  assert.equal(volumeCodec.parse('3'), 0.5);
});

test('JSON settings require structural validation', () => {
  assert.deepEqual(stringArrayCodec.parse('["a","b"]'), ['a', 'b']);
  assert.deepEqual(stringArrayCodec.parse('["a",3]'), []);

  const codec = jsonCodec<{ value: number }>(
    (value): value is { value: number } =>
      typeof value === 'object' &&
      value !== null &&
      typeof (value as { value?: unknown }).value === 'number',
    { value: 0 },
  );
  assert.deepEqual(codec.parse('{"value":2}'), { value: 2 });
  assert.deepEqual(codec.parse('{"value":"2"}'), { value: 0 });
});
