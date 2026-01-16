export enum AppRoute {
  HOME = 'home',
  HIDE = 'hide',
  REVEAL = 'reveal',
  ABOUT = 'about',
  EMOJI_HIDE = 'emoji_hide',
  EMOJI_REVEAL = 'emoji_reveal'
}

export interface StegoConfig {
  lsbDepth: number; // 1, 2, or 3
  isEncrypted: boolean;
  password?: string;
  compress: boolean;
}

export interface DecodedFile {
  fileName: string;
  mimeType: string;
  data: Uint8Array;
  isEncrypted: boolean;
  isCompressed: boolean;
  originalSize: number;
}

export interface HeaderData {
  version: number;
  flags: number;
  fileName: string;
  mimeType: string;
  originalSize: number;
  salt?: Uint8Array;
  iterations?: number;
  iv?: Uint8Array;
  payloadLength?: number; // Calculated after header parsing
}