#!/usr/bin/env node
// Tests for x8_remote.js. Needs only Node:
//
//   node --test tools/test_x8_remote.mjs
//
// The coded IDs below are the same test vectors as in the `chime` crate of the Oversample
// repository, which the X8's firmware uses to check a code. They are the only check that
// this page and the X8 agree.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const modulePath = new URL('../x8_remote.js', import.meta.url);
vm.runInThisContext(readFileSync(modulePath, 'utf8'), { filename: modulePath.pathname });
const X = globalThis.X8Remote;

const hex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(' ');

test('a command with no code is version 1, as B249 to B272 read it', () => {
    assert.equal(hex(X.plainId(1, 0)), '42 41 54 58 01 01 00 00');
    assert.equal(hex(X.plainId(2, 0)), '42 41 54 58 01 02 00 00');
    assert.equal(hex(X.plainId(3, 0)), '42 41 54 58 01 03 00 00');
    assert.equal(hex(X.plainId(4, 6)), '42 41 54 58 01 04 06 00');
});

test('SipHash-2-4 gives its published reference value', () => {
    const key = Uint8Array.from({ length: 16 }, (_, i) => i);
    const message = Uint8Array.from({ length: 15 }, (_, i) => i);
    assert.equal(X.sipHash24(key, message), 0xa129ca6149be45e5n);
});

test('a command with a code matches the chime crate', () => {
    assert.equal(hex(X.codedId('493817', 1, 0, 1794700800, 600)), '42 41 54 58 02 10 ba f3');
    assert.equal(hex(X.codedId('493817', 4, 6, 1794700801, -300)), '42 41 54 58 02 46 b0 ad');
    assert.equal(hex(X.codedId('000000', 3, 0, 0, 0)), '42 41 54 58 02 30 6b 0a');
});

test('a command with an accuracy matches the chime crate', () => {
    assert.equal(hex(X.accurateId('493817', 4, 1, 0, 1794700800, 600)), '42 41 54 58 34 10 f2 c8');
    assert.equal(hex(X.accurateId('493817', 0, 4, 6, 1794700801, -300)), '42 41 54 58 30 46 25 7f');
    assert.equal(hex(X.accurateId(null, 15, 2, 0, 1794700800, 600)), '42 41 54 58 4f 20 00 00');
});

test('an accuracy step is the first one that is not under the accuracy', () => {
    const steps = [[0, 1], [3, 1], [3.01, 2], [8.4, 4], [10, 4], [50, 8], [50.1, 9], [10000, 14], [10000.1, 15], [Infinity, 15], [-1, 0], [NaN, 0], [null, 0]];
    for (const [metres, step] of steps) assert.equal(X.accuracyStep(metres), step, String(metres));
});

test('a code is 6 digits, with or without spaces', () => {
    assert.equal(X.codeDigits('493817'), '493817');
    assert.equal(X.codeDigits(' 493 817 '), '493817');
    assert.equal(X.codeDigits('49381'), null);
    assert.equal(X.codeDigits('4938170'), null);
    assert.equal(X.codeDigits('49381a'), null);
    assert.equal(X.codeDigits(''), null);
});

test('the chime time is the next whole second at least 200 ms ahead', () => {
    const offset = -new Date(1794700800000).getTimezoneOffset();
    assert.deepEqual(X.chimeTime(new Date(1794700799500)), { unixTime: 1794700800, utcOffsetMinutes: offset });
    assert.deepEqual(X.chimeTime(new Date(1794700799000)), { unixTime: 1794700800, utcOffsetMinutes: offset });
    assert.deepEqual(X.chimeTime(new Date(1794700799801)), { unixTime: 1794700801, utcOffsetMinutes: offset });
    assert.deepEqual(X.chimeTime(new Date(1794700799800)), { unixTime: 1794700800, utcOffsetMinutes: offset });
});
