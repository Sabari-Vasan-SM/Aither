import React, { useState } from 'react';
import { Navbar, ActiveTab } from './components/Navbar';
import { Home } from './components/Home';
import { Sender } from './components/Sender';
import { Receiver } from './components/Receiver';
import { LoopbackTest } from './components/LoopbackTest';
import { ProtocolDocs } from './components/ProtocolDocs';
import { PrivacyBadge } from './components/PrivacyBadge';
import { QrCode, ShieldCheck, Heart, Github } from 'lucide-react';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');

  return (
    <div className="min-h-screen bg-[#080c14] text-slate-100 flex flex-col selection:bg-teal-500/30 selection:text-teal-200">
      {/* Top Navigation */}
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Content Area */}
      <main className="flex-1">
        {activeTab === 'home' && <Home setActiveTab={setActiveTab} />}
        {activeTab === 'send' && <Sender />}
        {activeTab === 'receive' && <Receiver />}
        {activeTab === 'loopback' && <LoopbackTest />}
        {activeTab === 'docs' && <ProtocolDocs />}
        {activeTab === 'privacy' && <PrivacyBadge />}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-[#080c14] py-8 text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <QrCode className="w-4 h-4 text-teal-400" />
            <span className="font-semibold text-slate-300">BitBeam</span>
            <span>—</span>
            <span>File Sharing Through Light, Not Servers</span>
          </div>

          <div className="flex items-center gap-6 text-slate-400">
            <button
              onClick={() => setActiveTab('privacy')}
              className="hover:text-teal-300 transition-colors flex items-center gap-1"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Zero-Storage Guarantee</span>
            </button>
            <button
              onClick={() => setActiveTab('docs')}
              className="hover:text-teal-300 transition-colors"
            >
              Protocol Specs
            </button>
            <button
              onClick={() => setActiveTab('loopback')}
              className="hover:text-teal-300 transition-colors"
            >
              Loopback Lab
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
