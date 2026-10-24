/**
 * Chunk Collector Module
 * Tracks, deduplicates, and manages incoming chunks for active transfer sessions
 */

import { MetadataFrame, ChunkFrame, TransferStats, TransferMetadata } from '../types/protocol';
import { base64ToUint8Array } from './base64';

export class ChunkCollector {
  private sessionId: string | null = null;
  private metadata: TransferMetadata | null = null;
  private chunks: Map<number, Uint8Array> = new Map();
  private duplicateCount: number = 0;
  private corruptedCount: number = 0;
  private totalChunksKnown: number = 0;
  private startedAt: number | null = null;
  private completedAt: number | null = null;
  private frameTimestamps: number[] = [];

  /**
   * Resets the collector state for a new transfer
   */
  public reset(): void {
    this.sessionId = null;
    this.metadata = null;
    this.chunks.clear();
    this.duplicateCount = 0;
    this.corruptedCount = 0;
    this.totalChunksKnown = 0;
    this.startedAt = null;
    this.completedAt = null;
    this.frameTimestamps = [];
  }

  /**
   * Records a frame processing timestamp for FPS calculation
   */
  private recordTimestamp(): void {
    const now = performance.now();
    if (!this.startedAt) {
      this.startedAt = Date.now();
    }
    this.frameTimestamps.push(now);
    // Keep last 3 seconds of timestamps for rolling FPS
    const cutoff = now - 3000;
    while (this.frameTimestamps.length > 0 && this.frameTimestamps[0] < cutoff) {
      this.frameTimestamps.shift();
    }
  }

  /**
   * Current frames per second
   */
  public getFPS(): number {
    if (this.frameTimestamps.length < 2) return 0;
    const durationSec = (this.frameTimestamps[this.frameTimestamps.length - 1] - this.frameTimestamps[0]) / 1000;
    if (durationSec <= 0) return 0;
    return Math.round((this.frameTimestamps.length - 1) / durationSec * 10) / 10;
  }

  /**
   * Record a corrupted frame
   */
  public recordCorruption(): void {
    this.corruptedCount++;
  }

  /**
   * Ingests a metadata frame
   * Returns true if metadata was accepted
   */
  public ingestMetadata(meta: MetadataFrame): { accepted: boolean; newSession: boolean } {
    this.recordTimestamp();

    let newSession = false;
    // Check if session changed
    if (this.sessionId && this.sessionId !== meta.sessionId) {
      this.reset();
      newSession = true;
    }

    this.sessionId = meta.sessionId;
    this.totalChunksKnown = meta.totalChunks;

    if (!this.metadata) {
      this.metadata = {
        sessionId: meta.sessionId,
        fileName: meta.fileName,
        fileSize: meta.fileSize,
        mimeType: meta.mimeType,
        totalChunks: meta.totalChunks,
        chunkSize: Math.ceil(meta.fileSize / meta.totalChunks),
        sha256: meta.sha256
      };
      return { accepted: true, newSession };
    }

    return { accepted: false, newSession: false }; // Already had metadata
  }

  /**
   * Ingests a data chunk frame
   */
  public ingestChunk(frame: ChunkFrame): {
    accepted: boolean;
    isDuplicate: boolean;
    sessionMismatch: boolean;
    isComplete: boolean;
  } {
    this.recordTimestamp();

    // Check if this chunk belongs to current session or if we are starting with this session
    if (!this.sessionId) {
      this.sessionId = frame.sessionId;
      this.totalChunksKnown = frame.totalChunks;
    } else if (this.sessionId !== frame.sessionId) {
      // Different session received while one is in progress
      return {
        accepted: false,
        isDuplicate: false,
        sessionMismatch: true,
        isComplete: false
      };
    }

    if (frame.totalChunks > this.totalChunksKnown) {
      this.totalChunksKnown = frame.totalChunks;
    }

    // Check if duplicate
    if (this.chunks.has(frame.chunkIndex)) {
      this.duplicateCount++;
      return {
        accepted: false,
        isDuplicate: true,
        sessionMismatch: false,
        isComplete: this.isComplete()
      };
    }

    // Decode and save chunk bytes
    try {
      const bytes = base64ToUint8Array(frame.payloadBase64);
      this.chunks.set(frame.chunkIndex, bytes);
    } catch {
      this.corruptedCount++;
      return {
        accepted: false,
        isDuplicate: false,
        sessionMismatch: false,
        isComplete: false
      };
    }

    const complete = this.isComplete();
    if (complete && !this.completedAt) {
      this.completedAt = Date.now();
    }

    return {
      accepted: true,
      isDuplicate: false,
      sessionMismatch: false,
      isComplete: complete
    };
  }

  /**
   * Checks if all chunks have been collected AND metadata is present
   */
  public isComplete(): boolean {
    if (!this.metadata || this.totalChunksKnown <= 0) {
      return false;
    }
    return this.chunks.size >= this.totalChunksKnown;
  }

  /**
   * Returns list of missing chunk indices
   */
  public getMissingChunkIndices(): number[] {
    if (this.totalChunksKnown <= 0) return [];
    const missing: number[] = [];
    for (let i = 0; i < this.totalChunksKnown; i++) {
      if (!this.chunks.has(i)) {
        missing.push(i);
      }
    }
    return missing;
  }

  /**
   * Returns bitmask / boolean array for each chunk index (received: true, missing: false)
   */
  public getChunkBitmask(): boolean[] {
    const total = this.totalChunksKnown;
    const bitmask = new Array<boolean>(total);
    for (let i = 0; i < total; i++) {
      bitmask[i] = this.chunks.has(i);
    }
    return bitmask;
  }

  /**
   * Current session ID
   */
  public getSessionId(): string | null {
    return this.sessionId;
  }

  /**
   * Metadata of the current transfer
   */
  public getMetadata(): TransferMetadata | null {
    return this.metadata;
  }

  /**
   * Ordered chunks as Uint8Array[]
   * Throws if incomplete
   */
  public getOrderedChunks(): Uint8Array[] {
    if (!this.isComplete()) {
      throw new Error('Cannot assemble file: chunks are missing');
    }

    const ordered: Uint8Array[] = [];
    for (let i = 0; i < this.totalChunksKnown; i++) {
      const chunk = this.chunks.get(i);
      if (!chunk) {
        throw new Error(`Missing chunk index ${i}`);
      }
      ordered.push(chunk);
    }
    return ordered;
  }

  /**
   * Computes comprehensive transfer statistics
   */
  public getStats(): TransferStats {
    const received = this.chunks.size;
    const total = this.totalChunksKnown;
    const missing = this.getMissingChunkIndices();
    const progressPercent = total > 0 ? Math.round((received / total) * 100) : 0;

    let bytesReceived = 0;
    for (const chunk of this.chunks.values()) {
      bytesReceived += chunk.byteLength;
    }

    const fps = this.getFPS();
    let estimatedRemainingSec: number | null = null;
    if (fps > 0 && missing.length > 0) {
      // Estimate with small overhead factor for scan misses
      estimatedRemainingSec = Math.ceil(missing.length / fps);
    }

    return {
      receivedChunks: received,
      totalChunks: total,
      duplicateChunks: this.duplicateCount,
      corruptedChunks: this.corruptedCount,
      missingChunks: missing,
      progressPercent,
      bytesReceived,
      totalBytes: this.metadata ? this.metadata.fileSize : bytesReceived,
      fps,
      estimatedRemainingSec,
      startedAt: this.startedAt,
      completedAt: this.completedAt
    };
  }
}
