import React from 'react';
import { QrCode, Send, ScanLine, ShieldCheck, BookOpen, FlaskConical, WifiOff } from 'lucide-react';

export type ActiveTab = 'home' | 'send' | 'receive' | 'loopback' | 'docs' | 'privacy';

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab }) => {
  return (
    <header className="sticky top-0 z-50 bg-[#080c14]/90 backdrop-blur-md border-b border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div 
          onClick={() => setActiveTab('home')}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-teal-400 via-teal-500 to-cyan-500 p-0.5 shadow-lg shadow-teal-500/20 group-hover:shadow-teal-500/40 transition-all duration-300">
            <div className="w-full h-full bg-[#080c14] rounded-[10px] flex items-center justify-center">
              <QrCode className="w-5 h-5 text-teal-400 group-hover:scale-110 transition-transform" />
            </div>
            {/* Optical beam indicator pulse */}
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-cyan-400 rounded-full animate-ping opacity-75" />
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-cyan-400 rounded-full" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-xl tracking-tight text-white group-hover:text-teal-300 transition-colors">
                Bit<span className="text-teal-400">Beam</span>
              </span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-400 border border-teal-500/20">
                v1.0
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">Optical File Transfer</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={() => setActiveTab('send')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'send'
                ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 shadow-sm shadow-teal-500/20'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Send className="w-4 h-4 text-teal-400" />
            <span>Send</span>
          </button>

          <button
            onClick={() => setActiveTab('receive')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'receive'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm shadow-cyan-500/20'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <ScanLine className="w-4 h-4 text-cyan-400" />
            <span>Receive</span>
          </button>

          <button
            onClick={() => setActiveTab('loopback')}
            className={`hidden md:flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'loopback'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm shadow-purple-500/20'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
            title="Single-device loopback transfer simulator"
          >
            <FlaskConical className="w-4 h-4 text-purple-400" />
            <span>Loopback Lab</span>
          </button>

          <button
            onClick={() => setActiveTab('docs')}
            className={`hidden lg:flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'docs'
                ? 'bg-slate-800 text-teal-300 border border-slate-700'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Protocol</span>
          </button>

          <button
            onClick={() => setActiveTab('privacy')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all border ${
              activeTab === 'privacy'
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : 'bg-emerald-950/30 text-emerald-400/90 border-emerald-800/40 hover:bg-emerald-900/30'
            }`}
            title="Zero storage & zero server audit"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Zero Storage</span>
            <WifiOff className="w-3 h-3 text-emerald-400 sm:ml-1" />
          </button>
        </nav>
      </div>
    </header>
  );
};
