import { ITERATIONS, SALT_LENGTH, KEY_LENGTH } from '../constants';

export const generateSalt = (): Uint8Array => {
  return window.crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
};

export const generateIV = (length: number): Uint8Array => {
  return window.crypto.getRandomValues(new Uint8Array(length));
};

export const deriveKey = async (password: string, salt: Uint8Array, iterations = ITERATIONS): Promise<CryptoKey> => {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );

  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: iterations,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: KEY_LENGTH },
    false,
    ["encrypt", "decrypt"]
  );
};

export const encryptData = async (data: Uint8Array, key: CryptoKey, iv: Uint8Array): Promise<Uint8Array> => {
  const encrypted = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv
    },
    key,
    data
  );
  return new Uint8Array(encrypted);
};

export const decryptData = async (encryptedData: Uint8Array, key: CryptoKey, iv: Uint8Array): Promise<Uint8Array> => {
  try {
    const decrypted = await window.crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: iv
      },
      key,
      encryptedData
    );
    return new Uint8Array(decrypted);
  } catch (e) {
    throw new Error("Decryption failed. Invalid password or corrupted data.");
  }
};

export const crc32 = (arr: Uint8Array): number => {
  let crc = -1;
  for (let i = 0; i < arr.length; i++) {
    crc = crc ^ arr[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (-(crc & 1) & 0xEDB88320);
    }
  }
  return (crc ^ -1) >>> 0;
};

// Compression Utilities using CompressionStream API
export const compressData = async (data: Uint8Array): Promise<Uint8Array> => {
  // @ts-ignore - CompressionStream is standard in modern browsers
  if (!window.CompressionStream) return data; 
  
  const stream = new Blob([data]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
};

export const decompressData = async (data: Uint8Array): Promise<Uint8Array> => {
  // @ts-ignore
  if (!window.DecompressionStream) return data;

  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
};

// Merge multiple Uint8Arrays
export const concatBytes = (...arrays: Uint8Array[]): Uint8Array => {
  const totalLength = arrays.reduce((acc, arr) => acc + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
};