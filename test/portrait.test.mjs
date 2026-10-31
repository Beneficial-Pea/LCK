import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAvatar, normalizePortrait } from '../lib/portrait.mjs';

const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF1QAAAAASUVORK5CYII=';
const dataUrl = (mime, bytes) => `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`;
const isBadAvatar = error => error instanceof Error && error.status === 400;

test('missing photos remain optional for old characters and explicit removal', () => {
  for (const value of [undefined, null, '']) assert.equal(normalizeAvatar(value), null);
});

test('raster photo data is retained in a canonical data URL', () => {
  assert.equal(normalizeAvatar(png), png);
  const jpeg = dataUrl('image/jpeg', [0xff, 0xd8, 0xff, 0xe0, 0, 4, 0xff, 0xd9]);
  const webp = dataUrl('image/webp', Buffer.from('RIFF\x04\0\0\0WEBP', 'binary'));
  assert.equal(normalizeAvatar(jpeg), jpeg);
  assert.equal(normalizeAvatar(webp), webp);
});

test('remote URLs, SVG, broken base64 and misleading MIME types are rejected', () => {
  const bad = [
    'https://example.com/player.png', 'javascript:alert(1)',
    'data:image/svg+xml;base64,' + Buffer.from('<svg onload="alert(1)"/>').toString('base64'),
    'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///w==',
    'data:image/png;base64,not*base64', 'data:image/png;base64,',
    'data:image/png;base64,' + Buffer.from('<script>alert(1)</script>').toString('base64'),
    png.replace('image/png', 'image/jpeg'), {}, 42
  ];
  for (const value of bad) assert.throws(() => normalizeAvatar(value), isBadAvatar);
});

test('the upload limit is measured in decoded bytes and rejects oversized photos', () => {
  const bytes = Buffer.alloc(64 * 1024, 0);
  Buffer.from([0xff, 0xd8, 0xff, 0xe0]).copy(bytes);
  const boundary = dataUrl('image/jpeg', bytes);
  assert.equal(normalizeAvatar(boundary), boundary);
  assert.throws(() => normalizeAvatar(dataUrl('image/jpeg', Buffer.concat([bytes, Buffer.from([0])]))), isBadAvatar);
});

test('portrait crops keep a private source and bounded normalized crop coordinates', () => {
  const source = dataUrl('image/png', Buffer.concat([Buffer.from(png.split(',')[1], 'base64'), Buffer.from('source')]));
  const result = normalizePortrait({ avatar: png, avatarSource: source, avatarCrop: { x: 0.2, y: 0.9, zoom: 2.5 } });
  assert.deepEqual(result, { avatar: png, avatarSource: source, avatarCrop: { x: 0.2, y: 0.9, zoom: 2.5 } });
  assert.deepEqual(normalizePortrait({ avatar: png }), { avatar: png, avatarSource: null, avatarCrop: { x: 0.5, y: 0.5, zoom: 1 } });
});

test('removing a photo clears its editing source and crop', () => {
  assert.deepEqual(normalizePortrait({ avatar: null, avatarSource: png, avatarCrop: { x: 0.1, y: 0.2, zoom: 3 } }), { avatar: null, avatarSource: null, avatarCrop: null });
  assert.deepEqual(normalizePortrait({}), { avatar: null, avatarSource: null, avatarCrop: null });
});

test('crop validation rejects out of bounds, nonfinite and malformed values', () => {
  const badCrops = [
    { x: -0.01, y: 0.5, zoom: 1 }, { x: 1.01, y: 0.5, zoom: 1 },
    { x: 0.5, y: -0.01, zoom: 1 }, { x: 0.5, y: 1.01, zoom: 1 },
    { x: 0.5, y: 0.5, zoom: 0.99 }, { x: 0.5, y: 0.5, zoom: 4.01 },
    { x: NaN, y: 0.5, zoom: 1 }, { x: 0.5, y: Infinity, zoom: 1 },
    { x: '0.5', y: 0.5, zoom: 1 }, { x: 0.5, y: 0.5, zoom: '1' },
    { x: 0.5, y: 0.5 }, [], 'center'
  ];
  for (const avatarCrop of badCrops) assert.throws(() => normalizePortrait({ avatar: png, avatarSource: png, avatarCrop }), isBadAvatar);
  assert.throws(() => normalizePortrait({ avatarSource: png }), isBadAvatar);
  assert.throws(() => normalizePortrait({ avatar: png, avatarSource: 'data:image/svg+xml;base64,PHN2Zy8+' }), isBadAvatar);
});
