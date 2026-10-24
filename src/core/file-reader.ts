/**
 * File Reader Module
 * Reads files cleanly using browser File/Blob APIs with metadata preservation
 */

export interface ReadFileInfo {
  file: File;
  name: string;
  extension: string;
  size: number;
  mimeType: string;
  lastModified: number;
}

/**
 * Extracts normalized metadata from a File object
 */
export function extractFileInfo(file: File): ReadFileInfo {
  const nameParts = file.name.split('.');
  const extension = nameParts.length > 1 ? (nameParts.pop()?.toLowerCase() || '') : '';

  return {
    file,
    name: file.name,
    extension,
    size: file.size,
    mimeType: file.type || 'application/octet-stream',
    lastModified: file.lastModified
  };
}

/**
 * Reads a sliced chunk of a File as Uint8Array
 */
export async function readFileSlice(file: File | Blob, start: number, end: number): Promise<Uint8Array> {
  const slice = file.slice(start, end);
  const buffer = await slice.arrayBuffer();
  return new Uint8Array(buffer);
}

/**
 * Reads an entire file as Uint8Array
 */
export async function readFileAsUint8Array(file: File | Blob): Promise<Uint8Array> {
  const buffer = await file.arrayBuffer();
  return new Uint8Array(buffer);
}
