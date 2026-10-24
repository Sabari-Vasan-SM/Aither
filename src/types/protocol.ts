/**
 * BitBeam QR Frame Protocol Specification (BB1)
 */

export const PROTOCOL_VERSION = 'BB1';

export type FrameType = 'M' | 'D' | 'R'; // M = Metadata, D = Data Chunk, R = Retransmit Request

export interface TransferMetadata {
  sessionId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  totalChunks: number;
  chunkSize: number;
  sha256: string;
}

export interface ChunkFrame {
  type: 'D';
  version: string;
  sessionId: string;
  chunkIndex: number;
  totalChunks: number;
  crc32: string; // 8-char hex
  payloadBase64: string;
}

export interface MetadataFrame {
  type: 'M';
  version: string;
  sessionId: string;
  totalChunks: number;
  fileSize: number;
  sha256: string;
  mimeType: string;
  fileName: string;
}

export interface RetransmitRequestFrame {
  type: 'R';
  version: string;
  sessionId: string;
  missingIndices: number[];
}

export type ParsedFrame = MetadataFrame | ChunkFrame | RetransmitRequestFrame;

export interface FrameValidationResult {
  valid: boolean;
  frame?: ParsedFrame;
  error?: string;
}

export interface TransferStats {
  receivedChunks: number;
  totalChunks: number;
  duplicateChunks: number;
  corruptedChunks: number;
  missingChunks: number[];
  progressPercent: number;
  bytesReceived: number;
  totalBytes: number;
  fps: number;
  estimatedRemainingSec: number | null;
  startedAt: number | null;
  completedAt: number | null;
}

export interface ReconstructedFile {
  name: string;
  size: number;
  mimeType: string;
  blob: Blob;
  url: string;
  sha256: string;
  verified: boolean;
}

export type SenderStatus = 'idle' | 'processing' | 'ready' | 'transmitting' | 'paused' | 'error';
export type ReceiverStatus = 'idle' | 'requesting_camera' | 'scanning' | 'reconstructing' | 'verifying' | 'completed' | 'error';
