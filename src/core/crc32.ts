/**
 * Fast CRC-32 implementation using pre-computed lookup table
 */

const CRC_TABLE = new Uint32Array(256);

// Precompute CRC table
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  CRC_TABLE[i] = c >>> 0;
}

/**
 * Computes CRC-32 for a Uint8Array or string
 * Returns an 8-character lowercase hexadecimal string
 */
export function crc32(data: Uint8Array | string): string {
  let c = 0xFFFFFFFF;
  
  if (typeof data === 'string') {
    for (let i = 0; i < data.length; i++) {
      const byte = data.charCodeAt(i) & 0xFF;
      c = (c >>> 8) ^ CRC_TABLE[(c ^ byte) & 0xFF];
    }
  } else {
    for (let i = 0; i < data.length; i++) {
      c = (c >>> 8) ^ CRC_TABLE[(c ^ data[i]) & 0xFF];
    }
  }

  const result = ((c ^ 0xFFFFFFFF) >>> 0).toString(16).padStart(8, '0');
  return result;
}
