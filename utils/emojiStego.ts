import { MAGIC_BYTES_EMOJI, VERSION } from '../constants';
import { crc32 } from './crypto';

// Mapping: 0 -> Zero Width Space, 1 -> Zero Width Non-Joiner
const BIT_0 = '\u200B'; 
const BIT_1 = '\u200C';

const EMOJI_SETS = {
  faces: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗'],
  animals: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🦄'],
  hearts: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓'],
  mixed: [] as string[]
};
EMOJI_SETS.mixed = [...EMOJI_SETS.faces, ...EMOJI_SETS.animals, ...EMOJI_SETS.hearts];

export type EmojiTheme = 'mixed' | 'faces' | 'animals' | 'hearts' | 'custom';

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

// Generate a sequence of cover emojis
const generateCoverEmojis = (count: number, theme: EmojiTheme): string[] => {
  const set = (theme !== 'custom' && EMOJI_SETS[theme]) ? EMOJI_SETS[theme] : EMOJI_SETS.mixed;
  const result = [];
  for(let i=0; i<count; i++) {
    result.push(set[Math.floor(Math.random() * set.length)]);
  }
  return result;
};

export const encodeEmojiMessage = (
  payload: Uint8Array,
  flags: number,
  salt: Uint8Array,
  iv: Uint8Array,
  theme: EmojiTheme = 'mixed',
  customEmojiSet: string[] = []
): string => {
  // 1. Build Header & Full Payload (Same structure as image stego)
  const magic = new Uint8Array(MAGIC_BYTES_EMOJI);
  const version = new Uint8Array([VERSION]);
  const flagsByte = new Uint8Array([flags]);
  const saltLen = new Uint8Array([salt.length]);
  const ivLen = new Uint8Array([iv.length]);
  const dataLen = numToBytes(payload.length, 4);
  const crc = numToBytes(crc32(payload), 4);

  const fullMessage = new Uint8Array(
    magic.length + version.length + flagsByte.length + 
    saltLen.length + salt.length + 
    ivLen.length + iv.length + 
    dataLen.length + crc.length + 
    payload.length
  );

  let offset = 0;
  fullMessage.set(magic, offset); offset += 4;
  fullMessage.set(version, offset); offset += 1;
  fullMessage.set(flagsByte, offset); offset += 1;
  fullMessage.set(saltLen, offset); offset += 1;
  fullMessage.set(salt, offset); offset += salt.length;
  fullMessage.set(ivLen, offset); offset += 1;
  fullMessage.set(iv, offset); offset += iv.length;
  fullMessage.set(dataLen, offset); offset += 4;
  fullMessage.set(crc, offset); offset += 4;
  fullMessage.set(payload, offset);

  // 2. Convert to bit string of invisible chars
  let invisibleString = '';
  for (const byte of fullMessage) {
    for (let i = 7; i >= 0; i--) {
      const bit = (byte >>> i) & 1;
      invisibleString += bit === 0 ? BIT_0 : BIT_1;
    }
  }

  // 3. Generate Cover Emojis
  // Strategy: Target a reasonable message length.
  // We want to avoid 1 giant invisible string which might be suspicious or truncated.
  // We interleave chunks of invisible chars between visible emojis.
  
  // Let's aim for ~24 visible emojis for a short message, scaling up slightly.
  // Base count 12, plus 1 emoji for every ~16 bytes of data?
  const emojiCount = Math.max(12, Math.ceil(fullMessage.length / 16));
  
  let coverEmojis: string[] = [];
  if (theme === 'custom' && customEmojiSet.length > 0) {
      for(let i=0; i<emojiCount; i++) {
          coverEmojis.push(customEmojiSet[Math.floor(Math.random() * customEmojiSet.length)]);
      }
  } else {
      // Fallback to mixed if custom is selected but no emojis provided (should be handled by UI)
      const targetTheme = theme === 'custom' ? 'mixed' : theme;
      coverEmojis = generateCoverEmojis(emojiCount, targetTheme);
  }

  // 4. Interleave
  // Calculate bits per emoji
  const totalBits = fullMessage.length * 8;
  const charsPerEmoji = Math.ceil(totalBits / emojiCount); // invisible chars per emoji

  let result = '';
  let charIdx = 0;

  for (let i = 0; i < coverEmojis.length; i++) {
    result += coverEmojis[i];
    // Append a chunk of invisible chars
    const end = Math.min(charIdx + charsPerEmoji, invisibleString.length);
    if (charIdx < invisibleString.length) {
        result += invisibleString.substring(charIdx, end);
        charIdx = end;
    }
  }
  
  // If any leftovers (due to rounding), append to last
  if (charIdx < invisibleString.length) {
    result += invisibleString.substring(charIdx);
  }

  return result;
};

export const decodeEmojiMessage = (text: string) => {
  // 1. Extract invisible characters
  let bitString = '';
  for (const char of text) {
    if (char === BIT_0) {
      bitString += '0';
    } else if (char === BIT_1) {
      bitString += '1';
    }
  }

  if (bitString.length === 0) {
    throw new Error("No hidden emoji data found.");
  }

  if (bitString.length % 8 !== 0) {
    // Attempt to salvage? or strict fail. 
    // Usually means truncation.
    // Let's try to floor to nearest 8
    bitString = bitString.substring(0, Math.floor(bitString.length / 8) * 8);
  }

  // 2. Convert bits to bytes
  const byteArray = new Uint8Array(bitString.length / 8);
  for (let i = 0; i < byteArray.length; i++) {
    const byteStr = bitString.substring(i * 8, (i + 1) * 8);
    byteArray[i] = parseInt(byteStr, 2);
  }

  // 3. Parse Header
  let ptr = 0;
  const read = (len: number) => {
    if (ptr + len > byteArray.length) throw new Error("Unexpected end of data");
    const slice = byteArray.slice(ptr, ptr + len);
    ptr += len;
    return slice;
  };
  const readByte = () => read(1)[0];

  try {
    const magic = read(4);
    if (magic[0] !== MAGIC_BYTES_EMOJI[0] || magic[1] !== MAGIC_BYTES_EMOJI[1] || 
        magic[2] !== MAGIC_BYTES_EMOJI[2] || magic[3] !== MAGIC_BYTES_EMOJI[3]) {
      throw new Error("Invalid emoji steganography header.");
    }

    const version = readByte();
    if (version !== VERSION) throw new Error(`Unsupported version: ${version}`);

    const flags = readByte();
    const isEncrypted = (flags & 1) === 1;

    const saltLen = readByte();
    const salt = read(saltLen);

    const ivLen = readByte();
    const iv = read(ivLen);

    const dataLenBytes = read(4);
    const payloadLen = bytesToNum(dataLenBytes);

    const crcBytes = read(4);
    const expectedCrc = bytesToNum(crcBytes);

    const payload = read(payloadLen);

    // CRC Check
    // IMPORTANT: crc32 returns unsigned int, expectedCrc must be compared as unsigned
    if (crc32(payload) !== expectedCrc) {
      throw new Error("Data corruption detected (CRC mismatch).");
    }

    return {
      isEncrypted,
      salt,
      iv,
      payload
    };

  } catch (e: any) {
    throw new Error(e.message || "Failed to decode emoji message");
  }
};