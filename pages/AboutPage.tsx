import React from 'react';
import { AppRoute } from '../types';

interface AboutPageProps {
  onNavigate: (route: AppRoute) => void;
}

export const AboutPage: React.FC<AboutPageProps> = () => {
  return (
    <div className="p-6 max-w-2xl mx-auto space-y-8 pb-10">
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-white">About PixelLock</h2>
        <p className="text-zinc-400 leading-relaxed">
          PixelLock is a secure, browser-based tool that uses steganography to hide encrypted text messages inside PNG images. 
          Unlike typical messaging apps, the "message" is invisible to the naked eye, appearing as a normal image file.
        </p>
      </div>

      <div className="space-y-4">
        <h3 className="text-xl font-semibold text-white">Privacy & Security</h3>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
          <ul className="list-disc pl-5 space-y-2 text-zinc-400 text-sm">
            <li><strong className="text-emerald-400">100% Local:</strong> All processing happens in your browser. No images or passwords are ever sent to a server.</li>
            <li><strong className="text-emerald-400">Encryption:</strong> If enabled, messages are encrypted using AES-256-GCM. Keys are derived using PBKDF2 with 200,000 iterations.</li>
            <li><strong className="text-emerald-400">No Persistence:</strong> Passwords are not stored. If you lose the password, the message is lost forever.</li>
          </ul>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-xl font-semibold text-white">Important Usage Warning</h3>
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
           <p className="text-yellow-500/90 text-sm">
             <strong>Social Media Compresses Images:</strong> Facebook, WhatsApp, Twitter, and Instagram often compress images (converting to JPEG), which 
             <span className="underline ml-1">will destroy</span> the hidden message. 
             Always send the file as a "Document" or "File" (e.g., via Email, Signal, Telegram File Share) to preserve the PNG format.
           </p>
        </div>
      </div>

      <div className="space-y-2 pt-4 border-t border-zinc-800">
        <h4 className="text-sm font-mono text-zinc-500">Technical Specs</h4>
        <pre className="text-xs text-zinc-600 font-mono bg-zinc-950 p-2 rounded">
          Algorithm: LSB (Least Significant Bit)
          Depths: 1-3 bits per channel
          Crypto: AES-GCM-256 / PBKDF2-HMAC-SHA256
          Container: Custom Header (Magic: STEG)
        </pre>
      </div>
    </div>
  );
};