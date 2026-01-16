import React, { useState } from 'react';
import { AppRoute } from '../types';
import { Eye, EyeOff, Copy, RefreshCw, CheckCircle, Smile, AlertTriangle, Calculator, Zap, X } from 'lucide-react';
import { deriveKey, encryptData, generateIV, generateSalt } from '../utils/crypto';
import { encodeEmojiMessage, EmojiTheme } from '../utils/emojiStego';
import { HEADER_STATIC_SIZE, SALT_LENGTH, IV_LENGTH } from '../constants';

interface EmojiHidePageProps {
  onNavigate: (route: AppRoute) => void;
}

export const EmojiHidePage: React.FC<EmojiHidePageProps> = ({ onNavigate }) => {
  const [message, setMessage] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [useEncryption, setUseEncryption] = useState(true);
  const [theme, setTheme] = useState<EmojiTheme>('mixed');
  const [customEmojiInput, setCustomEmojiInput] = useState('👻🔥');
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Calculate Estimation Stats
  const getStats = () => {
    const encoder = new TextEncoder();
    const msgLen = encoder.encode(message).length;
    
    // AES-GCM adds a 16-byte authentication tag to the ciphertext
    const encryptionOverhead = useEncryption ? 16 : 0; 
    
    // Header dynamic parts
    const currentSaltLen = useEncryption ? SALT_LENGTH : 0;
    const currentIvLen = useEncryption ? IV_LENGTH : 0;
    
    // Total bytes to be hidden (Payload + Header + Crypto Overhead)
    const totalDataBytes = HEADER_STATIC_SIZE + currentSaltLen + currentIvLen + msgLen + encryptionOverhead;
    
    // Heuristic from emojiStego.ts:
    // We aim for ~16 bytes of data per emoji to keep the string manageable, with a min of 12 emojis.
    // This creates a dense but not suspicious looking string.
    const estimatedEmojiCount = Math.max(12, Math.ceil(totalDataBytes / 16));
    
    return { msgLen, totalDataBytes, estimatedEmojiCount };
  };

  const stats = getStats();

  const handleGenerate = async () => {
    if (!message) return;
    if (useEncryption && !password) {
      setError("Password required for encryption.");
      return;
    }
    
    setIsProcessing(true);
    setError(null);
    setResult(null);

    setTimeout(async () => {
      try {
        const rawMessage = new TextEncoder().encode(message);
        let payload = rawMessage;
        let salt = new Uint8Array(0);
        let iv = new Uint8Array(0);
        let flags = 0;

        if (useEncryption) {
          salt = generateSalt();
          const key = await deriveKey(password, salt);
          iv = generateIV(12);
          payload = await encryptData(rawMessage, key, iv);
          flags = 1; 
        }

        let customEmojis: string[] = [];
        if (theme === 'custom') {
            if (!customEmojiInput) {
                throw new Error("Please enter at least one emoji for the custom theme.");
            }
            // Use Intl.Segmenter for proper emoji splitting if available
            if (typeof Intl !== 'undefined' && (Intl as any).Segmenter) {
                const segmenter = new (Intl as any).Segmenter('en', { granularity: 'grapheme' });
                customEmojis = Array.from(segmenter.segment(customEmojiInput)).map((x: any) => x.segment);
            } else {
                // Fallback for older browsers
                customEmojis = Array.from(customEmojiInput);
            }
        }

        const stegoText = encodeEmojiMessage(payload, flags, salt, iv, theme, customEmojis);
        setResult(stegoText);

      } catch (e: any) {
        setError(e.message);
      } finally {
        setIsProcessing(false);
      }
    }, 50);
  };

  const handleCopy = () => {
    if (result) {
      navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6 pb-20">
      <div className="flex items-center gap-2 mb-4">
        <div className="bg-purple-500/10 p-2 rounded-lg">
           <Smile className="w-6 h-6 text-purple-500" />
        </div>
        <h2 className="text-2xl font-bold">Emoji Hide</h2>
      </div>

      <div className="bg-purple-500/10 border border-purple-500/20 p-4 rounded-lg text-sm text-purple-200">
        <p>
          Hides your text inside invisible characters between emojis. 
          Result looks like a normal emoji string.
        </p>
      </div>

      {/* Message Input */}
      <div className="space-y-2">
        <div className="flex justify-between items-end">
             <div className="flex items-center gap-2">
                <label className="block text-sm font-medium text-zinc-400">Secret Message</label>
                {message && (
                    <button 
                        onClick={() => { setMessage(''); setResult(null); }}
                        className="flex items-center gap-1 text-xs text-zinc-500 hover:text-red-400 transition-colors px-2 py-0.5 rounded-full hover:bg-zinc-800"
                    >
                        <X className="w-3 h-3" /> Clear
                    </button>
                )}
             </div>
            <span className="text-xs text-zinc-500 font-mono">{stats.msgLen} bytes</span>
        </div>
        <textarea
          value={message}
          onChange={(e) => { setMessage(e.target.value); setResult(null); }}
          placeholder="Enter message..."
          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-sm focus:ring-2 focus:ring-purple-500 outline-none min-h-[100px]"
        />
      </div>

      {/* Estimation Stats Card */}
      <div className="grid grid-cols-2 gap-3">
         <div className="bg-zinc-900/80 border border-zinc-800 p-3 rounded-lg flex flex-col justify-center">
             <div className="flex items-center gap-2 text-zinc-500 text-xs mb-1">
                 <Zap className="w-3 h-3" />
                 <span>Total Encoded Size</span>
             </div>
             <span className="text-lg font-mono text-zinc-200">{stats.totalDataBytes} B</span>
         </div>
         <div className="bg-zinc-900/80 border border-zinc-800 p-3 rounded-lg flex flex-col justify-center">
             <div className="flex items-center gap-2 text-zinc-500 text-xs mb-1">
                 <Calculator className="w-3 h-3" />
                 <span>Resulting Emojis</span>
             </div>
             <span className="text-lg font-mono text-purple-400">~{stats.estimatedEmojiCount}</span>
         </div>
      </div>

      {/* Settings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Encryption */}
        <div className="bg-zinc-900/50 p-4 rounded-lg border border-zinc-800 space-y-3">
             <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-zinc-300">Encryption</label>
                <button 
                  onClick={() => setUseEncryption(!useEncryption)}
                  className={`w-10 h-6 rounded-full p-1 transition-colors ${useEncryption ? 'bg-purple-600' : 'bg-zinc-700'}`}
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
                        placeholder="Password"
                        className="w-full bg-zinc-950 border border-zinc-700 rounded-md py-2 px-3 text-sm pr-10 focus:border-purple-500 outline-none"
                    />
                    <button
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-2.5 text-zinc-500 hover:text-white"
                    >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                </div>
            )}
        </div>

        {/* Theme */}
        <div className="bg-zinc-900/50 p-4 rounded-lg border border-zinc-800 space-y-2">
           <label className="block text-sm font-medium text-zinc-300">Emoji Theme</label>
           <div className="grid grid-cols-2 gap-2">
              {(['mixed', 'faces', 'animals', 'hearts', 'custom'] as EmojiTheme[]).map(t => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={`px-3 py-2 text-xs rounded-md capitalize transition-colors ${
                    theme === t 
                    ? 'bg-purple-600 text-white' 
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  }`}
                >
                  {t}
                </button>
              ))}
           </div>
           
           {theme === 'custom' && (
              <div className="mt-3 animate-in fade-in slide-in-from-top-1">
                 <label className="block text-[10px] text-zinc-500 mb-1">Custom Emojis to use:</label>
                 <input 
                    type="text"
                    value={customEmojiInput}
                    onChange={(e) => setCustomEmojiInput(e.target.value)}
                    placeholder="Paste emojis here..."
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-md p-2 text-lg outline-none focus:border-purple-500"
                 />
              </div>
           )}
        </div>
      </div>

      <button
        onClick={handleGenerate}
        disabled={!message || (useEncryption && !password) || isProcessing}
        className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all ${
          !message || (useEncryption && !password)
            ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
            : 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg'
        }`}
      >
        {isProcessing ? <RefreshCw className="w-5 h-5 animate-spin"/> : "Generate Emoji Message"}
      </button>

      {/* Result */}
      {result && (
        <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4">
          <label className="block text-sm font-medium text-emerald-400 flex items-center gap-2">
            <CheckCircle className="w-4 h-4" /> Message Ready
          </label>
          <div className="relative group">
            <div className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl p-4 text-2xl break-words min-h-[80px]">
              {result}
            </div>
            <button
              onClick={handleCopy}
              className="absolute top-2 right-2 bg-zinc-900/80 p-2 rounded-lg text-white hover:bg-zinc-950 transition-colors border border-zinc-700"
            >
              {copied ? <CheckCircle className="w-5 h-5 text-emerald-500"/> : <Copy className="w-5 h-5"/>}
            </button>
          </div>
          <p className="text-xs text-zinc-500 text-center">
             Copy this text and paste it in WhatsApp, Telegram, or Email.
          </p>
          <div className="flex items-start gap-2 text-yellow-500/80 text-xs bg-yellow-500/5 p-3 rounded-lg border border-yellow-500/10">
             <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
             <p>Warning: Some apps (like SMS or Facebook posts) might strip invisible characters. Messaging apps (WhatsApp, Signal, Telegram) usually work best.</p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}
    </div>
  );
};