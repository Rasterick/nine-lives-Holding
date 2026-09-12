// icons/generate-icons.js
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function crc32(buf) {
  let table = [];
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }

  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ (-1)) >>> 0;
}

function writePng(width, height, pixelFn, outputPath) {
  const rowSize = width * 4;
  const rawData = Buffer.alloc(height * (rowSize + 1));

  let offset = 0;
  for (let y = 0; y < height; y++) {
    rawData[offset++] = 0; // Filter: None
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = pixelFn(x, y, width, height);
      rawData[offset++] = r;
      rawData[offset++] = g;
      rawData[offset++] = b;
      rawData[offset++] = a;
    }
  }

  const deflated = zlib.deflateSync(rawData);

  // PNG Header
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // 8 bits per channel
  ihdrData[9] = 6; // Color type: RGBA
  ihdrData[10] = 0; // Compression
  ihdrData[11] = 0; // Filter
  ihdrData[12] = 0; // Interlace

  const ihdrTypeAndData = Buffer.concat([Buffer.from('IHDR'), ihdrData]);
  const ihdrCrc = Buffer.alloc(4);
  ihdrCrc.writeUInt32BE(crc32(ihdrTypeAndData), 0);
  const ihdrLen = Buffer.alloc(4);
  ihdrLen.writeUInt32BE(13, 0);
  const ihdrChunk = Buffer.concat([ihdrLen, ihdrTypeAndData, ihdrCrc]);

  // IDAT chunk
  const idatTypeAndData = Buffer.concat([Buffer.from('IDAT'), deflated]);
  const idatCrc = Buffer.alloc(4);
  idatCrc.writeUInt32BE(crc32(idatTypeAndData), 0);
  const idatLen = Buffer.alloc(4);
  idatLen.writeUInt32BE(deflated.length, 0);
  const idatChunk = Buffer.concat([idatLen, idatTypeAndData, idatCrc]);

  // IEND chunk
  const iendType = Buffer.from('IEND');
  const iendCrc = Buffer.alloc(4);
  iendCrc.writeUInt32BE(crc32(iendType), 0);
  const iendLen = Buffer.alloc(4);
  iendLen.writeUInt32BE(0, 0);
  const iendChunk = Buffer.concat([iendLen, iendType, iendCrc]);

  const finalPng = Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
  fs.writeFileSync(outputPath, finalPng);
}

// Generate Tactical Hexagon Icon: Void Navy background + Cyber Cyan hex and core
function drawTacticalHex(x, y, w, h) {
  const cx = w / 2;
  const cy = h / 2;
  const dx = Math.abs(x - cx);
  const dy = Math.abs(y - cy);
  const radius = w * 0.42;

  // Hexagon distance formula
  const hexDist = Math.max(dx * 0.866025 + dy * 0.5, dy);

  // Outer border / background
  if (hexDist > radius) {
    return [0, 0, 0, 0]; // Transparent outside
  }

  // Hex border (Cyber Cyan: #00e5ff)
  if (hexDist >= radius - Math.max(1, w * 0.08)) {
    return [0, 229, 255, 255];
  }

  // Inner Core (Tactical reticle in center)
  const distFromCenter = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
  if (distFromCenter <= w * 0.18) {
    return [0, 229, 255, 255]; // Center core
  }

  // Background void fill (#050b14)
  return [5, 11, 20, 240];
}

const iconsDir = path.resolve('icons');
if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });

for (const size of [16, 48, 128]) {
  const p = path.join(iconsDir, `icon-${size}.png`);
  writePng(size, size, drawTacticalHex, p);
  console.log(`Generated ${size}x${size} tactical icon: ${p}`);
}
