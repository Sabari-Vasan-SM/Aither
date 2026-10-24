import React from 'react';
import { ShieldCheck, ServerOff, WifiOff, Lock, EyeOff, CheckCircle2, Terminal } from 'lucide-react';

export const PrivacyBadge: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-10">
      {/* Title */}
      <div className="pb-6 border-b border-slate-800">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-mono border border-emerald-500/30 mb-3">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Cryptographic & Architectural Audit</span>
        </div>
        <h1 className="text-3xl font-extrabold text-white">
          BitBeam Zero-Storage Privacy Guarantee
        </h1>
        <p className="text-slate-400 text-sm mt-2">
          Why your files can never be viewed, intercepted, or retained by BitBeam or third parties
        </p>
      </div>

      {/* Checklist */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          {
            title: 'No Ingress / Upload Endpoints',
            desc: 'BitBeam has zero server endpoints configured to receive multipart/form-data, binary blobs, or files.',
            icon: ServerOff,
            color: 'text-emerald-400'
          },
          {
            title: 'Zero WebSockets & WebRTC',
            desc: 'No signaling channels, STUN servers, or socket relays are used. Data travels strictly through optical light.',
            icon: WifiOff,
            color: 'text-teal-400'
          },
          {
            title: 'Volatile RAM Only',
            desc: 'Chunks are buffered in typed arrays in browser memory and flushed immediately upon session reset or tab close.',
            icon: Lock,
            color: 'text-cyan-400'
          },
          {
            title: 'Zero Tracking / Analytics',
            desc: 'No telemetry captures filenames, file sizes, or checksums. Your metadata stays local to your devices.',
            icon: EyeOff,
            color: 'text-purple-400'
          }
        ].map((item, idx) => (
          <div key={idx} className="p-5 rounded-xl bg-[#0e1524] border border-slate-800 space-y-2">
            <div className="flex items-center gap-2.5">
              <item.icon className={`w-5 h-5 ${item.color}`} />
              <h3 className="text-sm font-bold text-white">{item.title}</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">{item.desc}</p>
          </div>
        ))}
      </div>

      {/* DevTools Verification Guide */}
      <div className="p-6 rounded-2xl bg-[#090d16] border border-slate-800 space-y-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Terminal className="w-5 h-5 text-teal-400" />
          How to Independently Verify with Browser DevTools
        </h2>
        <p className="text-xs text-slate-300 leading-relaxed">
          You don't need to take our word for it. You can audit BitBeam yourself using your browser's built-in developer tools:
        </p>

        <ol className="list-decimal list-inside space-y-2 text-xs text-slate-400 font-mono">
          <li>Open your browser's Developer Tools (<kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-white">F12</kbd> or <kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-white">Cmd + Option + I</kbd>).</li>
          <li>Navigate to the <strong className="text-white">Network tab</strong> and check the <strong className="text-white">Disable cache</strong> box.</li>
          <li>Load the BitBeam application. You will see static JavaScript and CSS bundle requests.</li>
          <li>Click the <strong className="text-white">Clear network log</strong> button (🚫).</li>
          <li>Now select a file and send it to your phone using optical QR codes.</li>
          <li><strong className="text-teal-400">Observe the Network log: ZERO requests are triggered.</strong> Not a single byte leaves your computer over TCP/IP.</li>
        </ol>
      </div>

      {/* Offline PWA Compliance */}
      <div className="p-6 rounded-2xl bg-[#0e1524] border border-slate-800 space-y-3">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          Offline Progressive Web App (PWA)
        </h2>
        <p className="text-xs text-slate-300 leading-relaxed">
          BitBeam registers a Service Worker that caches application UI assets.
          Once opened or added to your device home screen, you can turn off Wi-Fi, Ethernet, and Mobile Data completely.
          Optical transmission continues working 100% offline.
        </p>
      </div>
    </div>
  );
};
