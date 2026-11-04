import { deflateSync, crc32 } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");
mkdirSync(root, { recursive: true });

const saffron = [196, 98, 45, 255];
const cream = [246, 237, 216, 255];
const water = [46, 111, 138, 255];
const fire = [196, 84, 44, 255];
const earth = [138, 98, 57, 255];
const air = [79, 125, 85, 255];

function zoneColor(deg) {
  const shifted = (deg + 11.25) % 360;
  const index = Math.floor(shifted / 22.5) % 16;
  if (index <= 2 || index === 15) return water;
  if (index <= 6) return fire;
  if (index <= 10) return earth;
  return air;
}

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
      let color = saffron;
      if (dist < 0.08) color = saffron;
      else if (dist < 0.18) color = cream;
      else if (dist < 0.4) color = zoneColor(deg);
      else if (dist < 0.44) color = cream;
      if ((deg < 3 || deg > 357) && dist > 0.4 && dist < 0.48) color = cream;
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
