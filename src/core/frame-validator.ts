/**
 * Frame Validator Module
 * Parses and validates BitBeam QR frame payloads, detects corruption, and rejects foreign QRs
 */

import { PROTOCOL_VERSION, ParsedFrame, FrameValidationResult, MetadataFrame, ChunkFrame, RetransmitRequestFrame } from '../types/protocol';
import { base64ToUint8Array, base64ToUtf8 } from './base64';
import { crc32 } from './crc32';

/**
 * Validates and parses raw text decoded from a QR code
 */
export function validateAndParseFrame(rawText: string): FrameValidationResult {
  if (!rawText || typeof rawText !== 'string') {
    return { valid: false, error: 'Empty or invalid QR content' };
  }

  // Must begin with the protocol version
  if (!rawText.startsWith(`${PROTOCOL_VERSION}|`)) {
    return { valid: false, error: `Not a BitBeam ${PROTOCOL_VERSION} frame` };
  }

  const parts = rawText.split('|');
  if (parts.length < 3) {
    return { valid: false, error: 'Malformed BitBeam frame structure' };
  }

  const [, type, sessionId] = parts;

  // Validate session ID
  if (!sessionId || sessionId.length < 4) {
    return { valid: false, error: 'Invalid transfer session identifier' };
  }

  if (type === 'M') {
    // BB1|M|sessionId|totalChunks|fileSize|sha256|mimeType|b64Name
    if (parts.length < 8) {
      return { valid: false, error: 'Incomplete metadata frame payload' };
    }

    const totalChunks = parseInt(parts[3], 10);
    const fileSize = parseInt(parts[4], 10);
    const sha256 = parts[5].toLowerCase();
    const mimeType = parts[6] || 'application/octet-stream';
    const b64Name = parts[7];

    if (isNaN(totalChunks) || totalChunks < 1) {
      return { valid: false, error: 'Invalid total chunks in metadata frame' };
    }

    if (isNaN(fileSize) || fileSize < 0) {
      return { valid: false, error: 'Invalid file size in metadata frame' };
    }

    if (!sha256 || sha256.length !== 64 || !/^[0-9a-f]{64}$/.test(sha256)) {
      return { valid: false, error: 'Invalid SHA-256 checksum in metadata frame' };
    }

    let fileName: string;
    try {
      fileName = base64ToUtf8(b64Name);
    } catch {
      return { valid: false, error: 'Corrupt filename encoding in metadata frame' };
    }

    const metadataFrame: MetadataFrame = {
      type: 'M',
      version: PROTOCOL_VERSION,
      sessionId,
      totalChunks,
      fileSize,
      sha256,
      mimeType,
      fileName
    };

    return { valid: true, frame: metadataFrame };
  }

  if (type === 'D') {
    // BB1|D|sessionId|chunkIndex|totalChunks|crc32|b64Payload
    if (parts.length < 7) {
      return { valid: false, error: 'Incomplete chunk frame payload' };
    }

    const chunkIndex = parseInt(parts[3], 10);
    const totalChunks = parseInt(parts[4], 10);
    const expectedCrc32 = parts[5].toLowerCase();
    const b64Payload = parts[6];

    if (isNaN(chunkIndex) || chunkIndex < 0) {
      return { valid: false, error: 'Invalid chunk index' };
    }

    if (isNaN(totalChunks) || totalChunks < 1 || chunkIndex >= totalChunks) {
      return { valid: false, error: 'Chunk index exceeds total chunks' };
    }

    if (!expectedCrc32 || expectedCrc32.length !== 8) {
      return { valid: false, error: 'Invalid CRC-32 checksum format' };
    }

    // Decode and verify chunk CRC32 integrity
    let chunkBytes: Uint8Array;
    try {
      chunkBytes = base64ToUint8Array(b64Payload);
    } catch {
      return { valid: false, error: 'Failed to decode Base64 chunk payload' };
    }

    const actualCrc32 = crc32(chunkBytes).toLowerCase();
    if (actualCrc32 !== expectedCrc32) {
      return {
        valid: false,
        error: `CRC-32 checksum mismatch (expected: ${expectedCrc32}, actual: ${actualCrc32})`
      };
    }

    const chunkFrame: ChunkFrame = {
      type: 'D',
      version: PROTOCOL_VERSION,
      sessionId,
      chunkIndex,
      totalChunks,
      crc32: expectedCrc32,
      payloadBase64: b64Payload
    };

    return { valid: true, frame: chunkFrame };
  }

  if (type === 'R') {
    // BB1|R|sessionId|missingIndices
    const missingCsv = parts[3] || '';
    const missingIndices = missingCsv
      ? missingCsv.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n))
      : [];

    const retransmitFrame: RetransmitRequestFrame = {
      type: 'R',
      version: PROTOCOL_VERSION,
      sessionId,
      missingIndices
    };

    return { valid: true, frame: retransmitFrame };
  }

  return { valid: false, error: `Unknown BitBeam frame type '${type}'` };
}
