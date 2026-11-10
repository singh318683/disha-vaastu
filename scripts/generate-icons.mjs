import { deflateSync, crc32 } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");
mkdirSync(root, { recursive: true });

const navy = [11, 16, 36, 255];
const face = [20, 27, 56, 255];
const gold = [228, 195, 106, 255];
const ivory = [246, 231, 178, 255];

function png(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const cx = size / 2;
  const cy = size / 2;
  for (let y = 0; y < size; y += 1) {
    const row = y * (size * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < size; x += 1) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const dist = Math.hypot(dx, dy) / size;
      let deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
      if (deg < 0) deg += 360;
      let color = navy;
      if (dist < 0.05) color = gold;
      else if (dist < 0.11) color = face;
      else if (dist < 0.125) color = gold;
      else if (dist < 0.3) color = face;
      else if (dist < 0.33) color = gold;
      if (deg < 8 && dist > 0.12 && dist < 0.3) color = ivory;
      const i = row + 1 + x * 4;
      raw[i] = color[0];
      raw[i + 1] = color[1];
      raw[i + 2] = color[2];
      raw[i + 3] = color[3];
    }
  }
  return encode(size, raw);
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const name = Buffer.from(type);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])) >>> 0, 0);
  return Buffer.concat([length, name, data, checksum]);
}

function encode(size, raw) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

for (const size of [180, 192, 512]) {
  const name = size === 180 ? "apple-touch-icon.png" : `icon-${size}.png`;
  writeFileSync(join(root, name), png(size));
}
console.log("wrote icons");
