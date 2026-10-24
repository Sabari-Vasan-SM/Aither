/**
 * Web Crypto API SHA-256 Checksum Calculator
 */

/**
 * Computes the SHA-256 hash of an ArrayBuffer, Uint8Array, or Blob
 * Returns a 64-character lowercase hexadecimal string
 */
export async function calculateSha256(data: ArrayBuffer | Uint8Array | Blob): Promise<string> {
  let buffer: ArrayBuffer;

  if (data instanceof Blob) {
    buffer = await data.arrayBuffer();
  } else if (data instanceof Uint8Array) {
    // If it's a subarray/view, get the actual sliced buffer or copy
    buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  } else {
    buffer = data;
  }

  // Use native Web Crypto API
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hex;
}

/**
 * Verifies that the computed hash of data matches the expected SHA-256 hash
 */
export async function verifySha256(data: ArrayBuffer | Uint8Array | Blob, expectedHash: string): Promise<boolean> {
  const actualHash = await calculateSha256(data);
  return actualHash.toLowerCase() === expectedHash.toLowerCase();
}
