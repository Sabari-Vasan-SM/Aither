import { describe, it, expect } from 'vitest';
import { crc32 } from '../crc32';
import { uint8ArrayToBase64, base64ToUint8Array, utf8ToBase64, base64ToUtf8 } from '../base64';
import { calculateSha256 } from '../crypto';
import { chunkBinaryData } from '../chunker';
import { generateSessionId, encodeMetadataPayload, encodeChunkPayload, encodeRetransmitPayload } from '../frame-encoder';
import { validateAndParseFrame } from '../frame-validator';
import { ChunkCollector } from '../chunk-collector';
import { reconstructFile, IntegrityVerificationError } from '../file-reconstructor';
import { MetadataFrame, ChunkFrame } from '../../types/protocol';

describe('BitBeam Protocol & Core Pipeline Tests', () => {

  it('CRC-32 produces accurate 8-char hex checksums', () => {
    const text = 'BitBeam Optical Protocol';
    const hex = crc32(text);
    expect(hex).toHaveLength(8);
    expect(hex).toMatch(/^[0-9a-f]{8}$/);

    // Identity check on Uint8Array
    const encoder = new TextEncoder();
    const bytes = encoder.encode(text);
    expect(crc32(bytes)).toBe(hex);
  });

  it('Base64 utility handles arbitrary binaries and unicode without corruption', () => {
    // Arbitrary binary array containing all byte values 0..255
    const originalBytes = new Uint8Array(512);
    for (let i = 0; i < originalBytes.length; i++) {
      originalBytes[i] = i % 256;
    }
    const b64 = uint8ArrayToBase64(originalBytes);
    const decodedBytes = base64ToUint8Array(b64);
    expect(decodedBytes).toEqual(originalBytes);

    // Unicode test
    const unicodeString = '🚀 BitBeam Transfer — ⚡️ Résumé_日本語.tar.gz';
    const b64Unicode = utf8ToBase64(unicodeString);
    const decodedUnicode = base64ToUtf8(b64Unicode);
    expect(decodedUnicode).toBe(unicodeString);
  });

  it('Handles empty files (0 bytes) gracefully', async () => {
    const emptyData = new Uint8Array(0);
    const hash = await calculateSha256(emptyData);
    const chunks = chunkBinaryData(emptyData, 384);
    expect(chunks.length).toBe(1);
    expect(chunks[0].size).toBe(0);

    const sessionId = generateSessionId();
    const metaPayload = encodeMetadataPayload({
      sessionId,
      totalChunks: chunks.length,
      fileSize: 0,
      sha256: hash,
      mimeType: 'text/plain',
      fileName: 'empty.txt'
    });

    const parsedMeta = validateAndParseFrame(metaPayload);
    expect(parsedMeta.valid).toBe(true);

    const chunkPayload = encodeChunkPayload({
      sessionId,
      chunk: chunks[0],
      totalChunks: chunks.length
    });

    const parsedChunk = validateAndParseFrame(chunkPayload);
    expect(parsedChunk.valid).toBe(true);

    const collector = new ChunkCollector();
    collector.ingestMetadata(parsedMeta.frame as MetadataFrame);
    collector.ingestChunk(parsedChunk.frame as ChunkFrame);

    expect(collector.isComplete()).toBe(true);
    const ordered = collector.getOrderedChunks();
    const reconstructed = await reconstructFile(ordered, collector.getMetadata()!);
    expect(reconstructed.size).toBe(0);
    expect(reconstructed.sha256).toBe(hash);
  });

  it('Transfers text, images, and binary files with out-of-order and duplicate frames', async () => {
    // Generate a 12 KB simulated binary image file
    const binaryData = new Uint8Array(12000);
    for (let i = 0; i < binaryData.length; i++) {
      binaryData[i] = (i * 7 + 13) % 256;
    }

    const sha256 = await calculateSha256(binaryData);
    const chunkSize = 256;
    const binaryChunks = chunkBinaryData(binaryData, chunkSize);
    expect(binaryChunks.length).toBe(Math.ceil(12000 / 256));

    const sessionId = generateSessionId();

    // Create payloads
    const metaPayload = encodeMetadataPayload({
      sessionId,
      totalChunks: binaryChunks.length,
      fileSize: binaryData.byteLength,
      sha256,
      mimeType: 'image/png',
      fileName: 'test_photo_📸.png'
    });

    const chunkPayloads = binaryChunks.map(c =>
      encodeChunkPayload({ sessionId, chunk: c, totalChunks: binaryChunks.length })
    );

    const collector = new ChunkCollector();

    // 1. Ingest metadata
    const metaResult = validateAndParseFrame(metaPayload);
    expect(metaResult.valid).toBe(true);
    collector.ingestMetadata(metaResult.frame as MetadataFrame);

    // 2. Ingest frames completely scrambled (out-of-order) and with duplicates
    const indices = Array.from({ length: chunkPayloads.length }, (_, i) => i);
    // Shuffle indices
    const shuffled = [...indices].sort(() => 0.5 - Math.random());

    // Ingest first half
    for (const idx of shuffled.slice(0, 20)) {
      const parsed = validateAndParseFrame(chunkPayloads[idx]);
      expect(parsed.valid).toBe(true);
      const res = collector.ingestChunk(parsed.frame as ChunkFrame);
      expect(res.accepted).toBe(true);
    }

    // Ingest some duplicates
    for (const idx of shuffled.slice(0, 10)) {
      const parsed = validateAndParseFrame(chunkPayloads[idx]);
      const res = collector.ingestChunk(parsed.frame as ChunkFrame);
      expect(res.isDuplicate).toBe(true);
      expect(res.accepted).toBe(false);
    }

    // Verify stats show duplicates and missing frames
    let stats = collector.getStats();
    expect(stats.duplicateChunks).toBe(10);
    expect(stats.receivedChunks).toBe(20);
    expect(stats.missingChunks.length).toBe(chunkPayloads.length - 20);

    // Ingest remainder of chunks
    for (const idx of shuffled.slice(20)) {
      const parsed = validateAndParseFrame(chunkPayloads[idx]);
      collector.ingestChunk(parsed.frame as ChunkFrame);
    }

    expect(collector.isComplete()).toBe(true);
    stats = collector.getStats();
    expect(stats.missingChunks.length).toBe(0);
    expect(stats.receivedChunks).toBe(chunkPayloads.length);

    // Reconstruct and verify hash
    const ordered = collector.getOrderedChunks();
    const reconstructed = await reconstructFile(ordered, collector.getMetadata()!);
    expect(reconstructed.verified).toBe(true);
    expect(reconstructed.name).toBe('test_photo_📸.png');
    expect(reconstructed.size).toBe(binaryData.byteLength);
    expect(reconstructed.sha256).toBe(sha256);
  });

  it('Detects corrupted frame payloads and CRC mismatches', () => {
    const rawData = new Uint8Array([1, 2, 3, 4, 5]);
    const chunks = chunkBinaryData(rawData, 100);
    const sessionId = generateSessionId();

    const validPayload = encodeChunkPayload({
      sessionId,
      chunk: chunks[0],
      totalChunks: 1
    });

    // Valid check
    const validResult = validateAndParseFrame(validPayload);
    expect(validResult.valid).toBe(true);

    // Corrupt the CRC in the payload string
    const parts = validPayload.split('|');
    parts[5] = 'ffffffff'; // Tampered CRC
    const tamperedCrcPayload = parts.join('|');
    const tamperedCrcResult = validateAndParseFrame(tamperedCrcPayload);
    expect(tamperedCrcResult.valid).toBe(false);
    expect(tamperedCrcResult.error).toContain('CRC-32 checksum mismatch');

    // Corrupt the Base64 data
    parts[5] = chunks[0].crc32;
    parts[6] = '!!!NotValidBase64!!!';
    const tamperedDataResult = validateAndParseFrame(parts.join('|'));
    expect(tamperedDataResult.valid).toBe(false);
  });

  it('Rejects foreign QR codes and incompatible protocols', () => {
    expect(validateAndParseFrame('https://example.com/login').valid).toBe(false);
    expect(validateAndParseFrame('WIFI:S:MyWifi;T:WPA;P:secret;;').valid).toBe(false);
    expect(validateAndParseFrame('BB2|D|1234|...').valid).toBe(false);
    expect(validateAndParseFrame('').valid).toBe(false);
  });

  it('Throws on final SHA-256 mismatch during reconstruction', async () => {
    const data = new Uint8Array([10, 20, 30, 40]);
    const chunks = chunkBinaryData(data, 100);
    const sessionId = generateSessionId();

    const metadata = {
      sessionId,
      fileName: 'spoofed.bin',
      fileSize: 4,
      mimeType: 'application/octet-stream',
      totalChunks: 1,
      chunkSize: 100,
      sha256: '0000000000000000000000000000000000000000000000000000000000000000' // Fake hash
    };

    await expect(reconstructFile([chunks[0].data], metadata)).rejects.toThrow(IntegrityVerificationError);
  });

  it('Supports Retransmission request frames', () => {
    const sessionId = generateSessionId();
    const missing = [2, 5, 14, 29];
    const retransmitPayload = encodeRetransmitPayload(sessionId, missing);

    const parsed = validateAndParseFrame(retransmitPayload);
    expect(parsed.valid).toBe(true);
    if (parsed.valid && parsed.frame?.type === 'R') {
      expect(parsed.frame.sessionId).toBe(sessionId);
      expect(parsed.frame.missingIndices).toEqual(missing);
    }
  });
});
