#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Create a simple PNG file with solid color
// PNG format: signature + IHDR + IDAT + IEND chunks
function createPNG(size) {
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  
  // IHDR chunk: image header (13 bytes data + 4 CRC)
  // width (4 bytes), height (4 bytes), bit depth, color type, etc.
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);    // width
  ihdr.writeUInt32BE(size, 4);    // height
  ihdr.writeUInt8(8, 8);           // bit depth
  ihdr.writeUInt8(2, 9);           // color type (2 = RGB)
  ihdr.writeUInt8(0, 10);          // compression
  ihdr.writeUInt8(0, 11);          // filter
  ihdr.writeUInt8(0, 12);          // interlace
  
  // CRC for IHDR
  const crc32 = (buf) => {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      crc = crc ^ buf[i];
      for (let j = 0; j < 8; j++) {
        crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
      }
    }
    return (crc ^ 0xffffffff) >>> 0;
  };
  
  const ihdrChunk = Buffer.concat([
    Buffer.from([0, 0, 0, 13]),     // chunk length
    Buffer.from('IHDR'),
    ihdr,
    Buffer.alloc(4)
  ]);
  ihdrChunk.writeUInt32BE(crc32(ihdr.toString('binary') + 'IHDR'), 17);
  
  // IDAT chunk: image data (simplified - single pixel scanline repeated)
  // Create minimal valid compressed data (just zeros)
  const pixelData = Buffer.alloc(size * size * 3 + size); // RGB + filter byte per line
  for (let i = 0; i < size; i++) {
    pixelData[i * (size * 3 + 1)] = 0; // filter type
    // Fill with blue color: #1E3A5F
    const r = 0x1E, g = 0x3A, b = 0x5F;
    for (let j = 0; j < size; j++) {
      pixelData[i * (size * 3 + 1) + 1 + j * 3] = r;
      pixelData[i * (size * 3 + 1) + 2 + j * 3] = g;
      pixelData[i * (size * 3 + 1) + 3 + j * 3] = b;
    }
  }
  
  const compressedData = zlib.deflateSync(pixelData);
  
  const idatChunk = Buffer.concat([
    Buffer.alloc(4),
    Buffer.from('IDAT'),
    compressedData,
    Buffer.alloc(4)
  ]);
  idatChunk.writeUInt32BE(compressedData.length, 0);
  idatChunk.writeUInt32BE(crc32(compressedData.toString('binary') + 'IDAT'), idatChunk.length - 4);
  
  // IEND chunk: image end
  const iendChunk = Buffer.concat([
    Buffer.from([0, 0, 0, 0]),
    Buffer.from('IEND'),
    Buffer.from([0xae, 0x42, 0x60, 0x82])
  ]);
  
  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

try {
  const publicDir = path.join(__dirname, 'public');
  
  // Generate icons
  const icon192 = createPNG(192);
  const icon512 = createPNG(512);
  
  fs.writeFileSync(path.join(publicDir, 'icon-192.png'), icon192);
  fs.writeFileSync(path.join(publicDir, 'icon-512.png'), icon512);
  
  console.log('✓ Generated icon-192.png');
  console.log('✓ Generated icon-512.png');
} catch (error) {
  console.error('Error generating icons:', error.message);
  process.exit(1);
}
