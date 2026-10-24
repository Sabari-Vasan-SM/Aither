/**
 * Chunker Module
 * Splits binary data / files into compact chunks with CRC-32 integrity tags
 */

import { crc32 } from './crc32';

export interface BinaryChunk {
  index: number;
  data: Uint8Array;
  crc32: string;
  size: number;
}

export const DEFAULT_CHUNK_SIZE = 384; // bytes (ideal for QR error correction level M & fast smartphone scanning)
export const MIN_CHUNK_SIZE = 96;
export const MAX_CHUNK_SIZE = 1024;

/**
 * Splits a Uint8Array into discrete BinaryChunk items
 */
export function chunkBinaryData(data: Uint8Array, chunkSize: number = DEFAULT_CHUNK_SIZE): BinaryChunk[] {
  const effectiveChunkSize = Math.max(MIN_CHUNK_SIZE, Math.min(chunkSize, MAX_CHUNK_SIZE));
  const totalLength = data.byteLength;
  
  // Handle empty file edge-case
  if (totalLength === 0) {
    const empty = new Uint8Array(0);
    return [
      {
        index: 0,
        data: empty,
        crc32: crc32(empty),
        size: 0
      }
    ];
  }

  const chunks: BinaryChunk[] = [];
  let offset = 0;
  let index = 0;

  while (offset < totalLength) {
    const nextOffset = Math.min(offset + effectiveChunkSize, totalLength);
    const chunkSlice = data.subarray(offset, nextOffset);
    
    chunks.push({
      index,
      data: chunkSlice,
      crc32: crc32(chunkSlice),
      size: chunkSlice.byteLength
    });

    index++;
    offset = nextOffset;
  }

  return chunks;
}
