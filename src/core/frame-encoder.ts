/**
 * Frame Encoder Module
 * Formats metadata and binary chunks into versioned BitBeam QR frame payloads
 */

import { PROTOCOL_VERSION, MetadataFrame, ChunkFrame, RetransmitRequestFrame } from '../types/protocol';
import { uint8ArrayToBase64, utf8ToBase64 } from './base64';
import { BinaryChunk } from './chunker';

/**
 * Generates an 8-character unique alphanumeric session ID
 */
export function generateSessionId(): string {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
  let id = '';
  const randomBytes = new Uint8Array(8);
  crypto.getRandomValues(randomBytes);
  for (let i = 0; i < 8; i++) {
    id += chars[randomBytes[i] % chars.length];
  }
  return id;
}

/**
 * Encodes a Metadata frame into a QR payload string
 * Format: BB1|M|sessionId|totalChunks|fileSize|sha256|mimeType|b64Name
 */
export function encodeMetadataPayload(meta: {
  sessionId: string;
  totalChunks: number;
  fileSize: number;
  sha256: string;
  mimeType: string;
  fileName: string;
}): string {
  const b64Name = utf8ToBase64(meta.fileName);
  const safeMime = meta.mimeType.replace(/\|/g, '_');
  return `${PROTOCOL_VERSION}|M|${meta.sessionId}|${meta.totalChunks}|${meta.fileSize}|${meta.sha256}|${safeMime}|${b64Name}`;
}

/**
 * Encodes a Chunk frame into a QR payload string
 * Format: BB1|D|sessionId|chunkIndex|totalChunks|crc32|b64Payload
 */
export function encodeChunkPayload(params: {
  sessionId: string;
  chunk: BinaryChunk;
  totalChunks: number;
}): string {
  const b64Payload = uint8ArrayToBase64(params.chunk.data);
  return `${PROTOCOL_VERSION}|D|${params.sessionId}|${params.chunk.index}|${params.totalChunks}|${params.chunk.crc32}|${b64Payload}`;
}

/**
 * Encodes a Retransmission Request into a QR payload string
 * Format: BB1|R|sessionId|missingIndicesCSV
 */
export function encodeRetransmitPayload(sessionId: string, missingIndices: number[]): string {
  return `${PROTOCOL_VERSION}|R|${sessionId}|${missingIndices.join(',')}`;
}
