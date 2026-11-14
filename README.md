# PixelLock 🔒
> Zero-knowledge client-side steganography suite. Conceal encrypted binary files, text, and audio payloads inside ordinary image pixels and Unicode emoji sequences.

[![Live App](https://img.shields.io/badge/Live_App-pixel--lock.vercel.app-10B981?style=flat-square&logo=vercel)](https://pixel-lock.vercel.app)
[![Web Crypto API](https://img.shields.io/badge/Cryptography-Web_Crypto_API-yellow?style=flat-square)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
[![Zero Server](https://img.shields.io/badge/Privacy-100%25_Client_Side-success?style=flat-square)](https://pixel-lock.vercel.app)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)

## 🌐 Live Application
Try the live tool: **[https://pixel-lock.vercel.app](https://pixel-lock.vercel.app)**

---

## 🔍 How It Works

### 1. Client-Side Encryption (AES-GCM 256-bit)
Secret payloads are encrypted entirely in-browser using the native **Web Crypto API** (`window.crypto.subtle`). Keys are derived from a user password using **PBKDF2** with a cryptographically secure random 16-byte salt and SHA-256 hashing.

### 2. Custom Binary Framing Protocol
Payloads are packed into a structured binary frame before embedding:
```text
[MAGIC (4B: PIXL)] [FLAGS (1B)] [SALT (16B)] [IV (12B)] [PAYLOAD LENGTH (4B)] [ENCRYPTED PAYLOAD] [CRC32 (4B)]
```
- **Checksum Verification**: A 4-byte CRC32 checksum guarantees data integrity and detects corruption before any decryption attempt.
- **Compression Flags**: Optional pre-encryption payload compression.

### 3. Least Significant Bit (LSB) Canvas Steganography
Encodes bits sequentially into the least significant bits of the red, green, and blue channels of an HTML5 Canvas pixel buffer. The visual difference is mathematically imperceptible to human vision ($\Delta E < 1$).

### 4. Emoji Zero-Width Steganography
Transforms binary bitstreams into alternating sequences of invisible Unicode characters:
- `\u200B` (Zero-Width Space) $\rightarrow$ `0`
- `\u200C` (Zero-Width Non-Joiner) $\rightarrow$ `1`

These invisible bytes are embedded within harmless emojis or text strings.

### 5. Zero-Knowledge Architecture
No data, keys, or images are ever transmitted to any server. All computations occur exclusively in volatile client memory.

---

## 🛠️ Tech Stack
- **Core Cryptography**: Web Crypto API (SubtleCrypto), AES-GCM, PBKDF2
- **Data Manipulation**: TypedArrays (`Uint8Array`, `DataView`), CRC32
- **Frontend**: React, TypeScript, HTML5 Canvas API, Tailwind CSS
- **Deployment**: Vercel

---

## 🚀 Local Setup

```bash
git clone https://github.com/rajdeepbhattacharyya25-pixel/pixel-lock.git
cd pixel-lock
npm install
npm run dev
```
