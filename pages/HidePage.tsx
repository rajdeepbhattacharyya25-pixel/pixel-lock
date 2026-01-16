import React, { useState, useRef, useEffect } from 'react';
import { AppRoute } from '../types';
import { Upload, Eye, EyeOff, Save, AlertTriangle, CheckCircle, Image as ImageIcon, File as FileIcon, FileText, Music, QrCode, Cpu, Settings, HardDrive, Maximize, X } from 'lucide-react';
import { deriveKey, encryptData, generateIV, generateSalt, compressData, concatBytes } from '../utils/crypto';
import { embedData, calculateMaxPayloadCapacity, estimateHeaderSize, buildStegFileHeader } from '../utils/steganography';
import { FLAG_ENCRYPTED, FLAG_COMPRESSED, FLAG_IS_IMAGE, FLAG_IS_AUDIO } from '../constants';
import QRCode from 'qrcode';

interface HidePageProps {
  onNavigate: (route: AppRoute) => void;
}

export const HidePage: React.FC<HidePageProps> = ({ onNavigate }) => {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [textMode, setTextMode] = useState(false); // Toggle between File and Text input
  const [textContent, setTextContent] = useState('');
  
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [useEncryption, setUseEncryption] = useState(true);
  const [useCompression, setUseCompression] = useState(true);
  const [lsbDepth, setLsbDepth] = useState(1);
  const [useAlpha, setUseAlpha] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrText, setQrText] = useState('');
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successBlob, setSuccessBlob] = useState<Blob | null>(null);
  const [processStats, setProcessStats] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const contentInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        setImage(img);
        setSuccessBlob(null);
        setError(null);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.[0]) {
          setSelectedFile(e.target.files[0]);
          setTextMode(false);
      }
  };

  const handleGenerateQr = async () => {
      if (!qrText) return;
      try {
          const url = await QRCode.toDataURL(qrText, { errorCorrectionLevel: 'H', width: 400 });
          const res = await fetch(url);
          const blob = await res.blob();
          const file = new File([blob], "qrcode.png", { type: "image/png" });
          setSelectedFile(file);
          setTextMode(false);
          setShowQrModal(false);
      } catch (e) {
          setError("Failed to generate QR Code");
      }
  };

  // --- CAPACITY LOGIC ---
  const getPayloadDetails = () => {
      if (textMode) {
          return {
              name: "message.txt",
              type: "text/plain",
              size: new TextEncoder().encode(textContent).length
          };
      } else if (selectedFile) {
          return {
              name: selectedFile.name,
              type: selectedFile.type || "application/octet-stream",
              size: selectedFile.size
          };
      }
      return { name: "unknown", type: "application/octet-stream", size: 0 };
  };

  const payload = getPayloadDetails();
  
  // Calculate specific capacity stats
  const headerSize = image ? estimateHeaderSize(payload.name, payload.type, useEncryption) : 0;
  
  // Capacity for the currently selected depth
  const currentCapacity = image ? calculateMaxPayloadCapacity(image.width, image.height, lsbDepth, headerSize, useEncryption, useAlpha) : 0;
  
  // Check fit for all depths to make recommendation
  const capacity1 = image ? calculateMaxPayloadCapacity(image.width, image.height, 1, headerSize, useEncryption, useAlpha) : 0;
  const capacity2 = image ? calculateMaxPayloadCapacity(image.width, image.height, 2, headerSize, useEncryption, useAlpha) : 0;
  const capacity3 = image ? calculateMaxPayloadCapacity(image.width, image.height, 3, headerSize, useEncryption, useAlpha) : 0;
  const capacity4 = image ? calculateMaxPayloadCapacity(image.width, image.height, 4, headerSize, useEncryption, useAlpha) : 0;
  
  const recommendedDepth = (() => {
      if (!image || payload.size === 0) return 1;
      if (payload.size <= capacity1) return 1;
      if (payload.size <= capacity2) return 2;
      if (payload.size <= capacity3) return 3;
      if (payload.size <= capacity4) return 4;
      return -1; // Too big
  })();

  // Auto-select depth on file/image change if current depth is insufficient
  useEffect(() => {
    if (recommendedDepth !== -1 && payload.size > currentCapacity && payload.size <= capacity4) {
         setLsbDepth(recommendedDepth);
    }
  }, [image, payload.size, recommendedDepth, capacity4, currentCapacity]);

  const percentageUsed = currentCapacity > 0 ? Math.min(100, (payload.size / currentCapacity) * 100) : 0;
  const isOverCapacity = payload.size > currentCapacity;

  const getRequiredResolution = (bytes: number) => {
      // rough reverse calculation for 3-bit RGB (most common 'safe' max)
      // Bytes = (Pixels * 3 * 3) / 8
      // Pixels = (Bytes * 8) / 9
      const pixelsNeeded = (bytes * 8) / 9;
      // Assume 4:3 aspect ratio: 4x * 3x = pixels -> 12x^2 = pixels -> x = sqrt(p/12)
      // Width = 4x, Height = 3x
      const x = Math.sqrt(pixelsNeeded / 12);
      const w = Math.round(4 * x);
      const h = Math.round(3 * x);
      return `${w} x ${h}`;
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleEmbed = async () => {
    if (!image) return;
    if (!selectedFile && !textContent) return;
    if (useEncryption && !password) {
      setError("Password is required for encryption.");
      return;
    }

    setIsProcessing(true);
    setError(null);
    setSuccessBlob(null);
    setProcessStats('');

    setTimeout(async () => {
      try {
        // 1. Prepare Payload
        let rawData: Uint8Array;
        let fileName: string;
        let mimeType: string;

        if (textMode) {
            rawData = new TextEncoder().encode(textContent);
            fileName = "message.txt";
            mimeType = "text/plain";
        } else if (selectedFile) {
            rawData = new Uint8Array(await selectedFile.arrayBuffer());
            fileName = selectedFile.name;
            mimeType = selectedFile.type || "application/octet-stream";
        } else {
            throw new Error("No content selected");
        }

        const originalSize = rawData.length;
        let processedData = rawData;
        let flags = 0;

        // Flags based on type
        if (mimeType.startsWith('image/')) flags |= FLAG_IS_IMAGE;
        if (mimeType.startsWith('audio/')) flags |= FLAG_IS_AUDIO;

        // 2. Compress
        if (useCompression) {
            processedData = await compressData(rawData);
            if (processedData.length < rawData.length) {
                flags |= FLAG_COMPRESSED;
            } else {
                processedData = rawData; // Revert if compression didn't help
            }
        }

        // 3. Encrypt
        let salt: Uint8Array | undefined;
        let iv: Uint8Array | undefined;
        
        if (useEncryption) {
            salt = generateSalt();
            iv = generateIV(12);
            const key = await deriveKey(password, salt);
            processedData = await encryptData(processedData, key, iv);
            flags |= FLAG_ENCRYPTED;
        }

        // 4. Build Header
        const header = buildStegFileHeader(fileName, mimeType, originalSize, flags, salt, iv);
        
        // Append Container Size (4 bytes) between header and payload as per our implementation decision
        // This size is the size of 'processedData'
        const sizeBytes = new Uint8Array(4);
        let s = processedData.length;
        for(let i=3; i>=0; i--) { sizeBytes[i] = s & 0xff; s >>= 8; }
        
        const finalBlob = concatBytes(header, sizeBytes, processedData);

        // 5. Embed
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) throw new Error("Canvas context failed");
        ctx.drawImage(image, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        const newImageData = embedData(imageData, finalBlob, lsbDepth, useAlpha);
        ctx.putImageData(newImageData, 0, 0);

        canvas.toBlob((blob) => {
          if (blob) {
            setSuccessBlob(blob);
            setProcessStats(`${formatBytes(originalSize)} → ${formatBytes(finalBlob.length)} (LSB ${lsbDepth})`);
          } else {
            setError("Failed to create blob");
          }
          setIsProcessing(false);
        }, 'image/png');

      } catch (err: any) {
        console.error(err);
        setError(err.message || "Embedding failed.");
        setIsProcessing(false);
      }
    }, 100);
  };

  const downloadImage = () => {
    if (!successBlob) return;
    const url = URL.createObjectURL(successBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stego_${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6 pb-20">
      <h2 className="text-2xl font-bold mb-4">Embed File</h2>

      {/* Image Selection */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-400">1. Carrier Image (PNG recommended)</label>
        <div 
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-zinc-700 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer hover:border-emerald-500 hover:bg-zinc-900 transition-all bg-zinc-900/30"
        >
          {image ? (
            <div className="relative w-full flex justify-center">
              <img src={image.src} alt="Preview" className="max-h-48 rounded-lg object-contain" />
              <button 
                onClick={(e) => { e.stopPropagation(); setImage(null); setSuccessBlob(null); }}
                className="absolute top-2 right-2 bg-black/60 p-1.5 rounded-full hover:bg-red-500/80 transition-colors"
              >
                <div className="w-4 h-4 text-white font-bold flex items-center justify-center">×</div>
              </button>
            </div>
          ) : (
            <div className="text-center">
              <ImageIcon className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
              <span className="text-zinc-500 text-sm">Tap to pick image</span>
            </div>
          )}
          <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/png, image/jpeg, image/webp" className="hidden" />
        </div>
        
        {/* Capacity Indicator Bar */}
        {image && (
             <div className="bg-zinc-900 rounded-lg p-3 border border-zinc-800 space-y-2">
                 <div className="flex justify-between text-xs font-medium">
                     <span className="text-zinc-400">Storage Utilization ({lsbDepth} Bit LSB {useAlpha ? '+ Alpha' : ''})</span>
                     <span className={`${isOverCapacity ? 'text-red-500' : 'text-zinc-400'}`}>
                         {formatBytes(payload.size)} / {formatBytes(currentCapacity)}
                     </span>
                 </div>
                 <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
                     <div 
                        className={`h-full transition-all duration-500 ${isOverCapacity ? 'bg-red-500' : percentageUsed > 80 ? 'bg-yellow-500' : 'bg-emerald-500'}`}
                        style={{ width: `${Math.min(100, percentageUsed)}%` }}
                     />
                 </div>
                 {recommendedDepth !== -1 && recommendedDepth !== lsbDepth && (
                     <div className="flex items-center gap-2 text-xs text-yellow-500 bg-yellow-500/10 p-2 rounded">
                         <AlertTriangle className="w-3 h-3" />
                         <span>Recommended: Switch to {recommendedDepth} Bit LSB for better capacity fit.</span>
                     </div>
                 )}
                 {recommendedDepth === -1 && (
                      <div className="flex flex-col gap-2 text-xs text-red-500 bg-red-500/10 p-2 rounded">
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="w-3 h-3" />
                            <span>File is too large for this image.</span>
                        </div>
                        <span className="text-zinc-400 ml-5">
                            To hide this file, you need an image at least <span className="text-white font-bold">{getRequiredResolution(payload.size)}</span> pixels in size.
                        </span>
                      </div>
                 )}
             </div>
        )}
      </div>

      {/* Payload Selection */}
      <div className="space-y-3">
         <label className="block text-sm font-medium text-zinc-400">2. Payload Content</label>
         
         <div className="flex gap-2 mb-2">
             <button 
               onClick={() => setTextMode(true)} 
               className={`flex-1 py-2 rounded-lg text-sm flex items-center justify-center gap-2 border ${textMode ? 'bg-zinc-800 border-emerald-500 text-white' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}
             >
                 <FileText className="w-4 h-4" /> Text
             </button>
             <button 
               onClick={() => setTextMode(false)} 
               className={`flex-1 py-2 rounded-lg text-sm flex items-center justify-center gap-2 border ${!textMode ? 'bg-zinc-800 border-emerald-500 text-white' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}
             >
                 <FileIcon className="w-4 h-4" /> File / QR
             </button>
         </div>

         {textMode ? (
             <div className="relative">
                 <textarea
                    value={textContent}
                    onChange={(e) => setTextContent(e.target.value)}
                    placeholder="Type your secret message..."
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-sm focus:border-emerald-500 outline-none min-h-[100px]"
                 />
                 {textContent && (
                    <button 
                        onClick={() => setTextContent('')}
                        className="absolute top-2 right-2 p-1.5 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 rounded-md transition-all"
                        title="Clear Text"
                    >
                        <X className="w-4 h-4" />
                    </button>
                 )}
             </div>
         ) : (
             <div className="grid grid-cols-1 gap-3">
                 <div onClick={() => contentInputRef.current?.click()} className="bg-zinc-900 border border-zinc-800 hover:border-emerald-500/50 p-4 rounded-lg cursor-pointer flex items-center justify-between transition-colors">
                     <div className="flex items-center gap-3">
                         {selectedFile ? (
                             selectedFile.type.startsWith('audio') ? <Music className="w-8 h-8 text-pink-500"/> :
                             selectedFile.type.startsWith('image') ? <ImageIcon className="w-8 h-8 text-blue-500"/> :
                             <FileIcon className="w-8 h-8 text-zinc-400"/>
                         ) : <FileIcon className="w-8 h-8 text-zinc-600"/>}
                         <div className="overflow-hidden">
                             <div className="font-medium text-sm text-zinc-200 truncate max-w-[200px]">
                                 {selectedFile ? selectedFile.name : "Select File"}
                             </div>
                             <div className="text-xs text-zinc-500">
                                 {selectedFile ? formatBytes(selectedFile.size) : "PDF, DOCX, Audio, Image..."}
                             </div>
                         </div>
                     </div>
                     <div className="bg-zinc-800 px-3 py-1.5 rounded text-xs font-medium text-zinc-400">Browse</div>
                 </div>
                 <input type="file" ref={contentInputRef} onChange={handleFileUpload} className="hidden" />
                 
                 <button onClick={() => setShowQrModal(true)} className="flex items-center justify-center gap-2 bg-zinc-900/50 border border-zinc-800 hover:bg-zinc-800 py-3 rounded-lg text-sm text-zinc-400 transition-colors">
                     <QrCode className="w-4 h-4" /> Generate QR Code to Embed
                 </button>
             </div>
         )}
      </div>

      {/* Settings */}
      <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-xl p-4 space-y-4">
           <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Settings className="w-4 h-4 text-zinc-400" />
                    <span className="text-sm font-medium text-zinc-300">Advanced Settings</span>
                </div>
           </div>

           <div className="grid grid-cols-1 gap-4">
                <div className="flex items-center justify-between bg-zinc-900/50 p-3 rounded-lg">
                    <span className="text-sm text-zinc-400">Encryption (AES-256)</span>
                    <button 
                        onClick={() => setUseEncryption(!useEncryption)}
                        className={`w-10 h-6 rounded-full p-1 transition-colors ${useEncryption ? 'bg-emerald-600' : 'bg-zinc-700'}`}
                    >
                        <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${useEncryption ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                </div>
                
                {useEncryption && (
                    <div className="relative">
                         <input
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Encryption Password"
                            className="w-full bg-zinc-950 border border-zinc-700 rounded-md py-2 px-3 text-sm pr-10 focus:border-emerald-500 outline-none"
                         />
                         <button onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-2.5 text-zinc-500">
                             {showPassword ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                         </button>
                    </div>
                )}

                <div className="flex items-center justify-between bg-zinc-900/50 p-3 rounded-lg">
                    <span className="text-sm text-zinc-400">Compression (Gzip)</span>
                    <button 
                        onClick={() => setUseCompression(!useCompression)}
                        className={`w-10 h-6 rounded-full p-1 transition-colors ${useCompression ? 'bg-emerald-600' : 'bg-zinc-700'}`}
                    >
                        <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${useCompression ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                </div>
                
                {/* Alpha Toggle */}
                <div className="flex items-center justify-between bg-zinc-900/50 p-3 rounded-lg">
                    <div className="flex flex-col">
                        <span className="text-sm text-zinc-400">Use Alpha Channel</span>
                        <span className="text-[10px] text-zinc-600">Adds 33% capacity but risky (data loss if alpha stripped).</span>
                    </div>
                    <button 
                        onClick={() => setUseAlpha(!useAlpha)}
                        className={`w-10 h-6 rounded-full p-1 transition-colors ${useAlpha ? 'bg-emerald-600' : 'bg-zinc-700'}`}
                    >
                        <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${useAlpha ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                </div>

                <div className="space-y-2">
                    <label className="text-xs text-zinc-500 uppercase font-bold tracking-wider">LSB Depth</label>
                    <div className="flex gap-2">
                        {[1, 2, 3, 4].map(d => (
                            <button
                                key={d}
                                onClick={() => setLsbDepth(d)}
                                className={`flex-1 py-1.5 text-xs font-medium rounded border ${lsbDepth === d ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}
                            >
                                {d} Bit
                            </button>
                        ))}
                    </div>
                    <p className="text-[10px] text-zinc-600 text-center">
                        4-bit doubles capacity but adds visible noise (film grain).
                    </p>
                </div>
           </div>
      </div>

      <div className="pt-2">
        {!successBlob ? (
             <button
                onClick={handleEmbed}
                disabled={!image || (!selectedFile && !textContent) || isProcessing || isOverCapacity}
                className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all ${
                    !image || (!selectedFile && !textContent) || isOverCapacity
                    ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg'
                }`}
             >
                {isProcessing ? <Cpu className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                {isProcessing ? "Processing..." : "Embed & Save Image"}
             </button>
        ) : (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-xl">
                    <div className="flex items-center gap-3 mb-2">
                        <CheckCircle className="w-6 h-6 text-emerald-500" />
                        <h4 className="font-semibold text-emerald-400">Embedding Successful</h4>
                    </div>
                    <p className="text-xs text-zinc-400 ml-9">{processStats}</p>
                </div>
                <button onClick={downloadImage} className="w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white shadow-lg">
                    <Save className="w-5 h-5" /> Download Result
                </button>
                <button onClick={() => { setSuccessBlob(null); setImage(null); }} className="w-full py-2 text-zinc-500 text-sm">Reset</button>
            </div>
        )}
      </div>
      
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-lg flex items-center gap-2 text-red-400 text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
        </div>
      )}

      {/* QR Modal */}
      {showQrModal && (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-6 backdrop-blur-sm">
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm p-6 space-y-4 animate-in zoom-in-95">
                  <h3 className="text-lg font-bold">Generate QR Code</h3>
                  <textarea 
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm min-h-[100px]" 
                    placeholder="Enter text or URL..."
                    value={qrText}
                    onChange={(e) => setQrText(e.target.value)}
                  />
                  <div className="flex gap-3">
                      <button onClick={() => setShowQrModal(false)} className="flex-1 py-2 text-zinc-400 hover:bg-zinc-800 rounded-lg">Cancel</button>
                      <button onClick={handleGenerateQr} disabled={!qrText} className="flex-1 py-2 bg-emerald-600 text-white rounded-lg font-medium">Use QR</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};