/**
 * Fast and safe Base64 encoding/decoding for Uint8Array and UTF-8 strings
 */

/**
 * Converts a Uint8Array into a Base64 string without overflowing call stack on large arrays
 */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  const chunkSize = 0x8000; // 32KB chunks to prevent stack overflow

  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
}

/**
 * Decodes a Base64 string into a Uint8Array
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Encodes an arbitrary UTF-8 string (e.g. unicode filenames) to URL-safe Base64
 */
export function utf8ToBase64(str: string): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  return uint8ArrayToBase64(bytes);
}

/**
 * Decodes a Base64 string to a UTF-8 string
 */
export function base64ToUtf8(base64: string): string {
  const bytes = base64ToUint8Array(base64);
  const decoder = new TextDecoder();
  return decoder.decode(bytes);
}
