import React, { useState } from 'react';
import { AppRoute } from '../types';
import { Unlock, Eye, EyeOff, AlertTriangle, FileText, Smile, X } from 'lucide-react';
import { deriveKey, decryptData } from '../utils/crypto';
import { decodeEmojiMessage } from '../utils/emojiStego';

interface EmojiRevealPageProps {
  onNavigate: (route: AppRoute) => void;
}

export const EmojiRevealPage: React.FC<EmojiRevealPageProps> = ({ onNavigate }) => {
  const [inputText, setInputText] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const handleReveal = async () => {
    if (!inputText) return;
    setIsProcessing(true);
    setError(null);
    setResult(null);

    setTimeout(async () => {
      try {
        const decodedData = decodeEmojiMessage(inputText);

        let messageText = '';

        if (decodedData.isEncrypted) {
            if (!password) {
                setError("This message is encrypted. Please enter the password.");
                setIsProcessing(false);
                return;
            }
            try {
                const key = await deriveKey(password, decodedData.salt);
                const decryptedBytes = await decryptData(decodedData.payload, key, decodedData.iv);
                messageText = new TextDecoder().decode(decryptedBytes);
            } catch (e) {
                throw new Error("Invalid password or corrupted data.");
            }
        } else {
            messageText = new TextDecoder().decode(decodedData.payload);
        }

        setResult(messageText);
      } catch (err: any) {
        setError(err.message || "Failed to reveal message.");
      } finally {
        setIsProcessing(false);
      }
    }, 50);
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6 pb-20">
      <div className="flex items-center gap-2 mb-4">
        <div className="bg-blue-500/10 p-2 rounded-lg">
           <Smile className="w-6 h-6 text-blue-500" />
        </div>
        <h2 className="text-2xl font-bold">Emoji Reveal</h2>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-center">
            <label className="block text-sm font-medium text-zinc-400">Paste Emoji Message</label>
            {inputText && (
                <button 
                    onClick={() => { setInputText(''); setResult(null); setError(null); }}
                    className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-1 rounded hover:bg-zinc-800"
                >
                    <X className="w-3 h-3" /> Clear
                </button>
            )}
        </div>
        <textarea
          value={inputText}
          onChange={(e) => { setInputText(e.target.value); setResult(null); setError(null); }}
          placeholder="Paste the emoji text here..."
          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-2xl focus:ring-2 focus:ring-blue-500 outline-none min-h-[120px]"
        />
      </div>

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
                <button
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-zinc-500 hover:text-white"
                >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
            </div>
      </div>

      <button
        onClick={handleReveal}
        disabled={!inputText || isProcessing}
        className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all ${
        !inputText
            ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg'
        }`}
        >
        {isProcessing ? "Decrypting..." : "Reveal Message"}
      </button>

      {result && (
         <div className="animate-in fade-in slide-in-from-bottom-4 space-y-2">
            <div className="flex items-center gap-2 text-emerald-500 font-medium">
                <FileText className="w-5 h-5" />
                <span>Message Decoded</span>
            </div>
            <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 min-h-[100px] whitespace-pre-wrap font-mono text-sm shadow-inner">
                {result}
            </div>
         </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-lg flex items-center gap-2 text-red-400 text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
        </div>
      )}
    </div>
  );
};