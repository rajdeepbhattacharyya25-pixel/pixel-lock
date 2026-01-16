import { MAGIC_BYTES, MAGIC_BYTES_FILE, VERSION, FLAG_ENCRYPTED, FLAG_COMPRESSED } from '../constants';
import { crc32, concatBytes } from './crypto';
import { HeaderData, DecodedFile } from '../types';

const numToBytes = (num: number, bytes: number) => {
  const arr = new Uint8Array(bytes);
  for (let i = bytes - 1; i >= 0; i--) {
    arr[i] = num & 0xff;
    num >>= 8;
  }
  return arr;
};

const bytesToNum = (arr: Uint8Array) => {
  let num = 0;
  for (const byte of arr) {
    num = (num << 8) | byte;
  }
  return num >>> 0; // Ensure unsigned 32-bit integer
};

// Helper for 64-bit size (BigEndian)
const bigIntToBytes = (num: number | bigint): Uint8Array => {
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  view.setBigUint64(0, BigInt(num), false); // Big Endian
  return new Uint8Array(buffer);
};

const bytesToBigInt = (arr: Uint8Array): number => {
  const buffer = arr.buffer.slice(arr.byteOffset, arr.byteOffset + arr.length);
  const view = new DataView(buffer);
  return Number(view.getBigUint64(0, false));
};

const setLsbs = (byte: number, bits: number, depth: number) => {
  const mask = (1 << depth) - 1;
  return (byte & ~mask) | (bits & mask);
};

const getLsbs = (byte: number, depth: number) => {
  return byte & ((1 << depth) - 1);
};

export const estimateHeaderSize = (fileName: string, mimeType: string, isEncrypted: boolean): number => {
  // Base: Magic(8) + Ver(1) + Flags(1) + NameLen(2) + Name(N) + MimeLen(2) + Mime(M) + OrigSize(8)
  // + ContainerSize(4) + HeaderCRC(4)
  const baseFixed = 8 + 1 + 1 + 2 + 2 + 8 + 4 + 4;
  const nameBytes = new TextEncoder().encode(fileName).length;
  const mimeBytes = new TextEncoder().encode(mimeType).length;
  
  let size = baseFixed + nameBytes + mimeBytes;

  if (isEncrypted) {
     // SaltLen(2) + Salt(16) + KDF(1) + Iter(4) + IVLen(1) + IV(12)
     // = 36 bytes
     size += 2 + 16 + 1 + 4 + 1 + 12;
  }

  return size;
};

export const calculateMaxPayloadCapacity = (width: number, height: number, depth: number, headerSize: number, isEncrypted: boolean, useAlpha: boolean = false) => {
  const totalPixels = width * height;
  const channels = useAlpha ? 4 : 3; // RGB vs RGBA
  const totalBits = totalPixels * channels * depth;
  const totalBytes = Math.floor(totalBits / 8);
  
  // AES-GCM adds a 16-byte authentication tag to the payload end
  const encryptionOverhead = isEncrypted ? 16 : 0;
  
  // The capacity available for the actual file data (compressed or not)
  return Math.max(0, totalBytes - headerSize - encryptionOverhead);
};

// --- NEW HEADER LOGIC ---

export const buildStegFileHeader = (
  fileName: string,
  mimeType: string,
  originalSize: number,
  flags: number,
  salt?: Uint8Array,
  iv?: Uint8Array,
  iterations?: number
): Uint8Array => {
  const magic = new Uint8Array(MAGIC_BYTES_FILE);
  const ver = new Uint8Array([VERSION]);
  const flagByte = new Uint8Array([flags]);
  
  const encName = new TextEncoder().encode(fileName);
  const nameLen = numToBytes(encName.length, 2);
  
  const encMime = new TextEncoder().encode(mimeType);
  const mimeLen = numToBytes(encMime.length, 2);
  
  const origSize = bigIntToBytes(originalSize);
  
  const parts = [magic, ver, flagByte, nameLen, encName, mimeLen, encMime, origSize];

  if (flags & FLAG_ENCRYPTED) {
    if (!salt || !iv) throw new Error("Encrypted flag set but missing Salt or IV");
    
    // Salt Length (2) + Salt (N)
    parts.push(numToBytes(salt.length, 2));
    parts.push(salt);
    
    // KDF Params: 0x01 (PBKDF2) + Iterations (4)
    parts.push(new Uint8Array([0x01])); 
    parts.push(numToBytes(iterations || 200000, 4));
    
    // IV Length (1) + IV (N)
    parts.push(new Uint8Array([iv.length]));
    parts.push(iv);
  }

  // No HMAC here in header itself; integrity check is done via CRC/GCM tag on payload
  // However, we append a CRC of the *header itself* to ensure header integrity before allocating memory for payload
  const partialHeader = concatBytes(...parts);
  const headerCrc = numToBytes(crc32(partialHeader), 4);
  
  return concatBytes(partialHeader, headerCrc);
};

export const embedData = (
  imageData: ImageData,
  fullDataBlob: Uint8Array, // Contains Header + Payload
  depth: number,
  useAlpha: boolean = false
): ImageData => {
  const pixels = imageData.data;
  const totalBits = fullDataBlob.length * 8;
  const channels = useAlpha ? 4 : 3;
  const totalBytesAvailable = Math.floor((imageData.width * imageData.height * channels * depth) / 8);
  
  if (fullDataBlob.length > totalBytesAvailable) {
    throw new Error(`Data exceeds capacity. Need ${fullDataBlob.length}B, have ${totalBytesAvailable}B.`);
  }

  let bitStreamIndex = 0;
  
  // Scramble/Distribution logic could go here. For now, we stick to linear LSB for robustness and speed.
  for (let i = 0; i < pixels.length; i += 4) {
    if (bitStreamIndex >= totalBits) break;

    for (let c = 0; c < channels; c++) { // RGB or RGBA
       if (bitStreamIndex >= totalBits) break;

       let bitsToEmbed = 0;
       for(let b=0; b < depth; b++) {
         if (bitStreamIndex < totalBits) {
           const byteIndex = Math.floor(bitStreamIndex / 8);
           const bitInByteIndex = 7 - (bitStreamIndex % 8); 
           const bit = (fullDataBlob[byteIndex] >>> bitInByteIndex) & 1;
           bitsToEmbed = (bitsToEmbed << 1) | bit;
           bitStreamIndex++;
         } else {
             bitsToEmbed = (bitsToEmbed << 1); 
         }
       }
       pixels[i + c] = setLsbs(pixels[i + c], bitsToEmbed, depth);
    }
  }

  return imageData;
};

// Parse header from a byte stream
const parseHeader = (stream: Uint8Array): { header: HeaderData, headerSize: number } => {
  let ptr = 0;
  const read = (n: number) => {
    const res = stream.slice(ptr, ptr + n);
    ptr += n;
    return res;
  };
  
  // Magic Check
  const magic = read(8);
  for(let i=0; i<8; i++) {
    if (magic[i] !== MAGIC_BYTES_FILE[i]) throw new Error("Invalid STEGFILE magic.");
  }
  
  const version = read(1)[0];
  if (version !== VERSION) throw new Error(`Unsupported version: ${version}`);
  
  const flags = read(1)[0];
  
  const nameLen = bytesToNum(read(2));
  const fileName = new TextDecoder().decode(read(nameLen));
  
  const mimeLen = bytesToNum(read(2));
  const mimeType = new TextDecoder().decode(read(mimeLen));
  
  const originalSize = bytesToBigInt(read(8));
  
  let salt: Uint8Array | undefined;
  let iterations: number | undefined;
  let iv: Uint8Array | undefined;
  
  if (flags & FLAG_ENCRYPTED) {
    const saltLen = bytesToNum(read(2));
    salt = read(saltLen);
    
    const kdfType = read(1)[0]; // 0x01 = PBKDF2
    iterations = bytesToNum(read(4));
    
    const ivLen = read(1)[0];
    iv = read(ivLen);
  }
  
  const storedCrc = bytesToNum(read(4));
  const headerBytes = stream.slice(0, ptr - 4);
  const actualCrc = crc32(headerBytes);
  
  if (storedCrc !== actualCrc) throw new Error("Header integrity check failed.");
  
  return {
    header: { version, flags, fileName, mimeType, originalSize, salt, iterations, iv },
    headerSize: ptr
  };
};

export const decodeFile = (imageData: ImageData, depth: number, useAlpha: boolean = false): { header: HeaderData, payload: Uint8Array } => {
  const pixels = imageData.data;
  const channels = useAlpha ? 4 : 3;
  
  // Re-implement stateful reader
  const state = { pixelIndex: 0, channelIndex: 0, bitBuffer: [] as number[] };
  
  const readNextByte = (): number => {
    while(state.bitBuffer.length < 8) {
       if (state.pixelIndex >= pixels.length) throw new Error("EOF");
       // Read channels up to `channels` (3 or 4)
       const val = pixels[state.pixelIndex + state.channelIndex];
       const bits = getLsbs(val, depth);
       for(let b=depth-1; b>=0; b--) state.bitBuffer.push((bits >>> b) & 1);
       
       state.channelIndex++;
       if (state.channelIndex >= channels) {
           state.channelIndex = 0;
           state.pixelIndex += 4;
       }
    }
    let b = 0;
    for(let i=0; i<8; i++) b = (b<<1) | state.bitBuffer.shift()!;
    return b;
  };
  
  // Helper to read N bytes
  const readNBytes = (n: number) => {
      const arr = new Uint8Array(n);
      for(let i=0; i<n; i++) arr[i] = readNextByte();
      return arr;
  };
  
  // 1. Read Magic first to fail fast
  // We read the first 8 bytes (magic bytes length)
  const magicBytes = readNBytes(8);
  
  // Check if legacy STEG or new STEGFILE
  // Legacy: S T E G (bytes 0-3) and byte 4 is NOT 'F'
  const isLegacy = magicBytes[0] === 83 && magicBytes[1] === 84 && magicBytes[2] === 69 && magicBytes[3] === 71 && magicBytes[4] !== 70;
  if (isLegacy) {
      throw new Error("Legacy message format detected. Use the 'Text' reveal mode or older version.");
  }

  // Check new Magic
  for(let i=0; i<8; i++) {
      if (magicBytes[i] !== MAGIC_BYTES_FILE[i]) throw new Error("Invalid Magic Bytes");
  }
  
  // 2. Proceed with parsing the rest of the header (without resetting state)
  const ver = readNextByte();
  if (ver !== VERSION) throw new Error(`Unsupported version: ${ver}`);

  const flags = readNextByte();
  
  const nameLen = bytesToNum(readNBytes(2));
  const fileName = new TextDecoder().decode(readNBytes(nameLen));
  
  const mimeLen = bytesToNum(readNBytes(2));
  const mimeType = new TextDecoder().decode(readNBytes(mimeLen));
  
  const originalSize = bytesToBigInt(readNBytes(8));
  
  let salt, iterations, iv;
  if (flags & FLAG_ENCRYPTED) {
      const saltLen = bytesToNum(readNBytes(2));
      salt = readNBytes(saltLen);
      readNextByte(); // KDF type
      iterations = bytesToNum(readNBytes(4));
      const ivLen = readNextByte();
      iv = readNBytes(ivLen);
  }
  
  const storedCrc = bytesToNum(readNBytes(4));
  // We skip strict CRC check of the header during stream reading to avoid buffering the whole header bits.
  
  // Container Size (4 bytes)
  const containerSize = bytesToNum(readNBytes(4));
  
  // Read Payload
  const payload = readNBytes(containerSize);
  
  return {
    header: { version: ver, flags, fileName, mimeType, originalSize, salt, iterations, iv },
    payload
  };
};