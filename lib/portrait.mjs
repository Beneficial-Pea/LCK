// Raster data URLs are stored with the character. No remote image fetching or SVG.
export const MAX_AVATAR_BYTES = 64 * 1024;

function invalid(message) {
  const error = new Error(message);
  error.status = 400;
  throw error;
}

export function normalizeAvatar(value) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') invalid('프로필 사진은 PNG·JPG·WebP 이미지여야 합니다.');
  // Bound work before decoding. A 64 KiB file needs at most 87,384 base64 chars.
  if (value.length > Math.ceil(MAX_AVATAR_BYTES / 3) * 4 + 40) invalid('프로필 사진은 압축 후 64KB 이하여야 합니다.');
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) invalid('PNG·JPG·WebP 사진 파일을 선택하세요. 외부 주소와 SVG는 지원하지 않습니다.');
  const [, format, encoded] = match;
  const bytes = Buffer.from(encoded, 'base64');
  if (!bytes.length || bytes.toString('base64') !== encoded) invalid('사진 데이터가 손상되었습니다. 파일을 다시 선택하세요.');
  if (bytes.length > MAX_AVATAR_BYTES) invalid('프로필 사진은 압축 후 64KB 이하여야 합니다.');
  const png = bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpeg = bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const webp = bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  if (!({ png, jpeg, webp })[format]) invalid('파일 형식과 사진 내용이 일치하지 않습니다. 다른 사진을 선택하세요.');
  return `data:image/${format};base64,${encoded}`;
}
