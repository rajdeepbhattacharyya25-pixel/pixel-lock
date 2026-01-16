import React, { useState, useRef } from 'react';
import { AppRoute, DecodedFile } from '../types';
import { Unlock, Upload, Eye, EyeOff, AlertTriangle, FileText, Image as ImageIcon, Music, Download, Play, Pause, File as FileIcon } from 'lucide-react';
import { deriveKey, decryptData, decompressData } from '../utils/crypto';
import { decodeFile } from '../utils/steganography';
import { FLAG_ENCRYPTED, FLAG_COMPRESSED, FLAG_IS_AUDIO, FLAG_IS_IMAGE } from '../constants';

interface RevealPageProps {
  onNavigate: (route: AppRoute) => void;
}

export const RevealPage: React.FC<RevealPageProps> = ({ onNavigate }) => {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [decodedFile, setDecodedFile] = useState<DecodedFile | null>(null);
  const [debugInfo, setDebugInfo] = useState<string | null>(null);
  
  // Audio Player State
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        setImage(img);
        setDecodedFile(null);
        setError(null);
        setDebugInfo(null);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleReveal = async () => {
    if (!image) return;
    setIsProcessing(true);
    setError(null);
    setDecodedFile(null);
    setDebugInfo(null);

    setTimeout(async () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) throw new Error("Canvas context failed");
        ctx.drawImage(image, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        // Auto-detect depth and channel configuration
        // Try depths 1-4, and try both RGB (3 channels) and RGBA (4 channels)
        let rawResult: any = null;
        let detectedConfig = "";
        
        // Outer loop: Depth
        for (let d = 1; d <= 4; d++) {
            // Inner loop: Channels (Standard RGB vs High Capacity RGBA)
            // Prioritize RGB (false) as it's default
            const configs = [false, true]; 
            
            for (const useAlpha of configs) {
                try {
                    rawResult = decodeFile(imageData, d, useAlpha);
                    detectedConfig = `Depth: ${d}, Alpha: ${useAlpha}`;
                    break;
                } catch (e) {
                    // Continue searching
                }
            }
            if (rawResult) break;
        }

        if (!rawResult) {
            throw new Error("No recognized steganography header found. Try checking if the image has been compressed or altered.");
        }

        const { header, payload } = rawResult;
        let finalData = payload;

        if (header.flags & FLAG_ENCRYPTED) {
            if (!password) {
                setDebugInfo(`Encrypted payload found (${detectedConfig}). Please enter password.`);
                setIsProcessing(false);
                return;
            }
            const key = await deriveKey(password, header.salt!, header.iterations);
            finalData = await decryptData(finalData, key, header.iv!);
        }

        if (header.flags & FLAG_COMPRESSED) {
            finalData = await decompressData(finalData);
        }

        setDecodedFile({
            fileName: header.fileName,
            mimeType: header.mimeType,
            data: finalData,
            originalSize: header.originalSize,
            isEncrypted: !!(header.flags & FLAG_ENCRYPTED),
            isCompressed: !!(header.flags & FLAG_COMPRESSED)
        });

      } catch (err: any) {
        console.error(err);
        setError(err.message || "Extraction failed.");
      } finally {
        setIsProcessing(false);
      }
    }, 100);
  };

  const downloadFile = () => {
      if (!decodedFile) return;
      const blob = new Blob([decodedFile.data], { type: decodedFile.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = decodedFile.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  };

  const renderPreview = () => {
      if (!decodedFile) return null;
      const blob = new Blob([decodedFile.data], { type: decodedFile.mimeType });
      const url = URL.createObjectURL(blob);

      // Image Preview
      if (decodedFile.mimeType.startsWith('image/')) {
          return (
              <div className="mt-4 rounded-xl overflow-hidden border border-zinc-700 bg-black/20">
                  <img src={url} alt="Decoded" className="max-w-full h-auto mx-auto" />
              </div>
          );
      }

      // Audio Preview
      if (decodedFile.mimeType.startsWith('audio/')) {
          return (
              <div className="mt-4 bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center gap-4">
                  <button 
                    onClick={() => {
                        if (audioRef.current) {
                            if (isPlaying) audioRef.current.pause();
                            else audioRef.current.play();
                            setIsPlaying(!isPlaying);
                        }
                    }}
                    className="w-12 h-12 rounded-full bg-emerald-600 flex items-center justify-center hover:bg-emerald-500 transition-colors"
                  >
                      {isPlaying ? <Pause className="w-5 h-5 text-white" /> : <Play className="w-5 h-5 text-white ml-1" />}
                  </button>
                  <div className="flex-1">
                      <div className="text-sm font-medium text-white">{decodedFile.fileName}</div>
                      <div className="text-xs text-zinc-500">Audio Clip</div>
                  </div>
                  <audio ref={audioRef} src={url} onEnded={() => setIsPlaying(false)} className="hidden" />
              </div>
          );
      }

      // Default Text Preview
      if (decodedFile.mimeType.startsWith('text/')) {
          const text = new TextDecoder().decode(decodedFile.data);
          return (
              <div className="mt-4 bg-zinc-900 border border-zinc-800 rounded-xl p-4 max-h-60 overflow-y-auto font-mono text-sm whitespace-pre-wrap">
                  {text}
              </div>
          );
      }

      return null;
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6 pb-20">
      <h2 className="text-2xl font-bold mb-4">Reveal Payload</h2>

      {/* Image Input */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-400">Upload Source Image</label>
        <div 
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-zinc-700 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 hover:bg-zinc-900 transition-all"
        >
           {image ? (
            <div className="relative w-full flex justify-center">
              <img src={image.src} alt="Preview" className="max-h-64 rounded-lg object-contain" />
              <button 
                onClick={(e) => { e.stopPropagation(); setImage(null); setDecodedFile(null); }}
                className="absolute top-2 right-2 bg-black/50 p-1 rounded-full hover:bg-red-500/80"
              >
                <div className="w-4 h-4 text-white font-bold flex items-center justify-center">×</div>
              </button>
            </div>
          ) : (
            <>
              <ImageIcon className="w-12 h-12 text-zinc-600 mb-2" />
              <span className="text-zinc-500">Click to upload (PNG)</span>
            </>
          )}
          <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/png" className="hidden" />
        </div>
      </div>

      {/* Password Input */}
      <div className="bg-zinc-900/50 p-4 rounded-lg border border-zinc-800 space-y-2">
            <label className="text-sm font-medium text-zinc-300">Decryption Password (if needed)</label>
            <div className="relative">
                <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password..."
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-md py-2 px-3 text-sm pr-10 focus:border-blue-500 outline-none"
                />
                <button onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-2.5 text-zinc-500 hover:text-white">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
            </div>
      </div>

      <button
        onClick={handleReveal}
        disabled={!image || isProcessing}
        className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all ${
        !image ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg'
        }`}
      >
        {isProcessing ? "Processing..." : "Reveal Content"}
      </button>

      {/* Result Section */}
      {decodedFile && (
         <div className="animate-in fade-in slide-in-from-bottom-4 space-y-4">
             <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-xl">
                 <div className="flex items-center gap-3">
                     <FileIcon className="w-6 h-6 text-emerald-500" />
                     <div>
                         <h4 className="font-semibold text-emerald-400">Payload Extracted</h4>
                         <div className="flex items-center gap-2 text-xs text-zinc-400 mt-1">
                            <span>{decodedFile.fileName}</span>
                            <span>•</span>
                            <span>{(decodedFile.data.length / 1024).toFixed(1)} KB</span>
                            {decodedFile.isEncrypted && <span className="text-blue-400">• Encrypted</span>}
                            {decodedFile.isCompressed && <span className="text-orange-400">• Compressed</span>}
                         </div>
                     </div>
                 </div>
             </div>

             {renderPreview()}

             <button onClick={downloadFile} className="w-full py-3 rounded-xl font-bold text-lg flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 transition-all">
                <Download className="w-5 h-5" /> Save File
             </button>
         </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-lg flex items-center gap-2 text-red-400 text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
        </div>
      )}
      
      {debugInfo && !error && (
         <div className="text-center text-xs text-yellow-500">{debugInfo}</div>
      )}

    </div>
  );
};