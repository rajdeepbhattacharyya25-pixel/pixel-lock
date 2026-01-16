import React from 'react';
import { AppRoute } from '../types';
import { ShieldCheck, Info, ArrowLeft } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  currentRoute: AppRoute;
  onNavigate: (route: AppRoute) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, currentRoute, onNavigate }) => {
  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-100 max-w-4xl mx-auto w-full shadow-2xl overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          {currentRoute !== AppRoute.HOME && (
            <button 
              onClick={() => onNavigate(AppRoute.HOME)}
              className="p-2 rounded-full hover:bg-zinc-800 transition-colors"
              aria-label="Go Back"
            >
              <ArrowLeft className="w-5 h-5 text-zinc-400" />
            </button>
          )}
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => onNavigate(AppRoute.HOME)}>
            <div className="bg-emerald-500/10 p-2 rounded-lg">
                <ShieldCheck className="w-6 h-6 text-emerald-500" />
            </div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
              PixelLock
            </h1>
          </div>
        </div>
        
        <button 
          onClick={() => onNavigate(AppRoute.ABOUT)}
          className="text-zinc-400 hover:text-emerald-400 transition-colors"
          title="About & Privacy"
        >
          <Info className="w-6 h-6" />
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden relative bg-zinc-950">
        {children}
      </main>

      {/* Status Footer - mostly for aesthetics */}
      <footer className="px-6 py-2 bg-zinc-900 border-t border-zinc-800 text-xs text-zinc-500 flex justify-between">
        <span>Offline Secure Environment</span>
        <span>v1.0.0</span>
      </footer>
    </div>
  );
};