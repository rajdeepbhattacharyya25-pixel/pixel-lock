import React, { useState } from 'react';
import { AppRoute } from '../types';
import { Lock, Unlock, Image as ImageIcon, Smile } from 'lucide-react';

interface HomePageProps {
  onNavigate: (route: AppRoute) => void;
}

type Mode = 'image' | 'emoji';

export const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  const [mode, setMode] = useState<Mode>('image');

  return (
    <div className="flex flex-col items-center justify-center h-full p-6 gap-6 animate-in fade-in duration-500">
      <div className="text-center space-y-2 max-w-md">
        <h2 className="text-3xl font-bold text-white">Hide Secrets in Plain Sight</h2>
        <p className="text-zinc-400">
          Securely embed text messages inside images or emoji strings using local encryption.
        </p>
      </div>

      {/* Mode Switcher */}
      <div className="flex bg-zinc-900 p-1 rounded-xl border border-zinc-800">
        <button
          onClick={() => setMode('image')}
          className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-medium transition-all ${
            mode === 'image' 
              ? 'bg-zinc-800 text-white shadow-sm' 
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <ImageIcon className="w-4 h-4" />
          Image Mode
        </button>
        <button
          onClick={() => setMode('emoji')}
          className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-medium transition-all ${
            mode === 'emoji' 
              ? 'bg-zinc-800 text-white shadow-sm' 
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Smile className="w-4 h-4" />
          Emoji Mode
        </button>
      </div>

      {mode === 'image' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-lg animate-in slide-in-from-right-4 fade-in duration-300">
          {/* Hide Action */}
          <button
            onClick={() => onNavigate(AppRoute.HIDE)}
            className="group relative flex flex-col items-center justify-center p-8 gap-4 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-emerald-500/50 hover:bg-zinc-800/80 transition-all duration-300 hover:shadow-xl hover:shadow-emerald-900/10"
          >
            <div className="p-4 rounded-full bg-emerald-500/10 group-hover:bg-emerald-500/20 transition-colors">
              <Lock className="w-10 h-10 text-emerald-500" />
            </div>
            <div className="text-center">
              <h3 className="text-xl font-semibold text-zinc-100">Hide in Image</h3>
              <p className="text-sm text-zinc-500 mt-1">Embed text into a PNG file</p>
            </div>
          </button>

          {/* Reveal Action */}
          <button
            onClick={() => onNavigate(AppRoute.REVEAL)}
            className="group relative flex flex-col items-center justify-center p-8 gap-4 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-blue-500/50 hover:bg-zinc-800/80 transition-all duration-300 hover:shadow-xl hover:shadow-blue-900/10"
          >
            <div className="p-4 rounded-full bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors">
              <Unlock className="w-10 h-10 text-blue-500" />
            </div>
            <div className="text-center">
              <h3 className="text-xl font-semibold text-zinc-100">Reveal from Image</h3>
              <p className="text-sm text-zinc-500 mt-1">Extract data from an image</p>
            </div>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-lg animate-in slide-in-from-right-4 fade-in duration-300">
          {/* Hide Action Emoji */}
          <button
            onClick={() => onNavigate(AppRoute.EMOJI_HIDE)}
            className="group relative flex flex-col items-center justify-center p-8 gap-4 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-purple-500/50 hover:bg-zinc-800/80 transition-all duration-300 hover:shadow-xl hover:shadow-purple-900/10"
          >
            <div className="p-4 rounded-full bg-purple-500/10 group-hover:bg-purple-500/20 transition-colors">
              <Smile className="w-10 h-10 text-purple-500" />
            </div>
            <div className="text-center">
              <h3 className="text-xl font-semibold text-zinc-100">Hide in Text</h3>
              <p className="text-sm text-zinc-500 mt-1">Generate invisible emoji text</p>
            </div>
          </button>

          {/* Reveal Action Emoji */}
          <button
            onClick={() => onNavigate(AppRoute.EMOJI_REVEAL)}
            className="group relative flex flex-col items-center justify-center p-8 gap-4 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-pink-500/50 hover:bg-zinc-800/80 transition-all duration-300 hover:shadow-xl hover:shadow-pink-900/10"
          >
            <div className="p-4 rounded-full bg-pink-500/10 group-hover:bg-pink-500/20 transition-colors">
              <Unlock className="w-10 h-10 text-pink-500" />
            </div>
            <div className="text-center">
              <h3 className="text-xl font-semibold text-zinc-100">Reveal from Text</h3>
              <p className="text-sm text-zinc-500 mt-1">Decrypt emoji messages</p>
            </div>
          </button>
        </div>
      )}

      <div className="mt-8 p-4 rounded-lg bg-zinc-900/50 border border-zinc-800 max-w-md text-center">
        {mode === 'image' ? (
             <p className="text-xs text-zinc-500">
              <strong>Tip:</strong> Image Mode is best for larger files and requires sending as a Document (PNG).
            </p>
        ) : (
             <p className="text-xs text-zinc-500">
              <strong>Tip:</strong> Emoji Mode creates copy-pasteable text. Works best on WhatsApp, Telegram, and Signal.
            </p>
        )}
      </div>
    </div>
  );
};
