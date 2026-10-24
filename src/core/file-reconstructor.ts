/**
 * File Reconstructor Module
 * Assembles binary chunks into a complete file, verifies SHA-256 hash, and generates downloadable Blob
 */

import { ReconstructedFile, TransferMetadata } from '../types/protocol';
import { calculateSha256 } from './crypto';

export class IntegrityVerificationError extends Error {
  constructor(public expected: string, public actual: string) {
    super(`SHA-256 verification failed! Expected ${expected}, got ${actual}`);
    this.name = 'IntegrityVerificationError';
  }
}

/**
 * Reconstructs a file from ordered Uint8Array chunks and metadata
 */
export async function reconstructFile(
  chunks: Uint8Array[],
  metadata: TransferMetadata
): Promise<ReconstructedFile> {
  // Compute total byte size
  let totalBytes = 0;
  for (const chunk of chunks) {
    totalBytes += chunk.byteLength;
  }

  // Allocate single contiguous Uint8Array
  const combinedBuffer = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    combinedBuffer.set(chunk, offset);
    offset += chunk.byteLength;
  }

  // Verify SHA-256 checksum byte-for-byte
  const computedHash = await calculateSha256(combinedBuffer);
  const matches = computedHash.toLowerCase() === metadata.sha256.toLowerCase();

  if (!matches) {
    throw new IntegrityVerificationError(metadata.sha256, computedHash);
  }

  // Create downloadable Blob
  const blob = new Blob([combinedBuffer], { type: metadata.mimeType || 'application/octet-stream' });
  const url = URL.createObjectURL(blob);

  return {
    name: metadata.fileName,
    size: combinedBuffer.byteLength,
    mimeType: metadata.mimeType,
    blob,
    url,
    sha256: computedHash,
    verified: true
  };
}

/**
 * Initiates automatic or user-triggered browser download of a reconstructed file
 */
export function triggerFileDownload(file: ReconstructedFile): void {
  const link = document.createElement('a');
  link.href = file.url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
