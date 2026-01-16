export const MAGIC_BYTES = [83, 84, 69, 71]; // STEG (Legacy)
export const MAGIC_BYTES_EMOJI = [69, 77, 79, 74]; // EMOJ
export const MAGIC_BYTES_FILE = [0x53, 0x54, 0x45, 0x47, 0x46, 0x49, 0x4C, 0x45]; // STEGFILE

export const VERSION = 1;
export const SALT_LENGTH = 16;
export const IV_LENGTH = 12; // AES-GCM standard
export const ITERATIONS = 200000; 
export const KEY_LENGTH = 256;

// Flags for STEGFILE header
export const FLAG_ENCRYPTED = 1 << 0;
export const FLAG_COMPRESSED = 1 << 1;
export const FLAG_IS_IMAGE = 1 << 2;
export const FLAG_IS_AUDIO = 1 << 3;

// Base overhead for the new file header (variable length, but useful for initial estimates)
// Magic(8) + Ver(1) + Flags(1) + NameLen(2) + MimeLen(2) + OrigSize(8) = 22 bytes minimum fixed
export const HEADER_FILE_BASE_SIZE = 22;
// Base overhead for Emoji header (Magic(4) + Ver(1) + Flags(1) + SaltLen(1) + IvLen(1) + DataLen(4) + CRC(4))
export const HEADER_STATIC_SIZE = 16;