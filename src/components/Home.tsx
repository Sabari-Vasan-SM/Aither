import React, { useEffect, useRef, useState } from 'react';
import { Send, ScanLine, ShieldCheck, Zap, Lock, EyeOff, ServerOff, ArrowRight, Sparkles, CheckCircle2 } from 'lucide-react';
import { ActiveTab } from './Navbar';
import { renderQRToCanvas } from '../core/qr-renderer';

interface HomeProps {
  setActiveTab: (tab: ActiveTab) => void;
}

export const Home: React.FC<HomeProps> = ({ setActiveTab }) => {
  const heroCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [demoFrame, setDemoFrame] = useState(0);

  // Animated QR demo frames
  useEffect(() => {
    const demoPayloads = [
      'BB1|M|bb7a19c4|8|3072|e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855|image/png|Qml0QmVhbV9EZW1vLnBuZw==',
      'BB1|D|bb7a19c4|0|8|a1b2c3d4|iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkWPjfDwAEcQHzqC3d2QAAAABJRU5ErkJggg==',
      'BB1|D|bb7a19c4|1|8|e5f6a7b8|iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'BB1|D|bb7a19c4|2|8|9c8b7a6f|iVBORw0KGgoAAAANSUhEUgAAAAMAAAADCAYAAABWKLW/AAAAF0lEQVR42mP8//8/AwMDw0AAHwYEQQIAZ08HA2j0FzYAAAAASUVORK5CYII='
    ];

    let intervalId: NodeJS.Timeout;
    let idx = 0;

    const renderNext = async () => {
      if (heroCanvasRef.current) {
        try {
          await renderQRToCanvas(heroCanvasRef.current, demoPayloads[idx], {
            width: 220,
            margin: 2,
            errorCorrectionLevel: 'M',
            darkColor: '#00f5c4',
            lightColor: '#080c14'
          });
          setDemoFrame(idx);
          idx = (idx + 1) % demoPayloads.length;
        } catch {
          // ignore
        }
      }
    };

    renderNext();
    intervalId = setInterval(renderNext, 350);

    return () => clearInterval(intervalId);
  }, []);

  return (
    <div className="relative overflow-hidden">
      {/* Background radial glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 left-1/3 w-[400px] h-[400px] bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Hero Section */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-16">
        <div className="text-center max-w-3xl mx-auto space-y-6">
          {/* Zero server guarantee pill */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-300 text-xs font-mono tracking-wide">
            <ServerOff className="w-3.5 h-3.5 text-teal-400" />
            <span>100% Client-Side Optical Air-Gap</span>
            <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight">
            Your files. Your light.{' '}
            <span className="block mt-1 bg-gradient-to-r from-teal-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
              Zero servers.
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-300 font-normal leading-relaxed">
            BitBeam converts any file into an animated high-density optical QR sequence.
            Scan with your phone's camera to reconstruct the exact binary file in real-time.
            <span className="text-teal-300 font-medium"> No cloud, no WebSockets, no WebRTC, zero network traffic.</span>
          </p>

          {/* Primary Action Buttons */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => setActiveTab('send')}
              className="w-full sm:w-auto px-8 py-4 rounded-xl font-semibold text-base bg-gradient-to-r from-teal-500 to-teal-400 hover:from-teal-400 hover:to-teal-300 text-slate-950 shadow-xl shadow-teal-500/25 flex items-center justify-center gap-3 transition-all duration-200 transform hover:-translate-y-0.5 active:translate-y-0"
            >
              <Send className="w-5 h-5" />
              <span>Send a File</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>

            <button
              onClick={() => setActiveTab('receive')}
              className="w-full sm:w-auto px-8 py-4 rounded-xl font-semibold text-base bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 hover:border-cyan-500/50 text-white shadow-xl flex items-center justify-center gap-3 transition-all duration-200 transform hover:-translate-y-0.5"
            >
              <ScanLine className="w-5 h-5 text-cyan-400" />
              <span>Receive a File</span>
            </button>
          </div>
        </div>

        {/* Live Animated Optical Visualizer Demo Card */}
        <div className="mt-14 max-w-4xl mx-auto">
          <div className="relative rounded-2xl bg-[#0b1220]/90 border border-slate-800 p-6 sm:p-8 shadow-2xl backdrop-blur-sm overflow-hidden">
            {/* Top terminal bar */}
            <div className="flex items-center justify-between pb-6 border-b border-slate-800/80 mb-6">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-rose-500/80" />
                <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                <span className="text-xs font-mono text-slate-400 ml-2">BitBeam Optical Link Protocol BB1</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono text-teal-400">
                <span className="w-2 h-2 rounded-full bg-teal-400 animate-ping" />
                <span>OPTICAL BEAM ACTIVE</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              {/* Left: Animated QR Frame */}
              <div className="flex flex-col items-center justify-center">
                <div className="p-3 bg-[#080c14] rounded-2xl border-2 border-teal-500/40 shadow-xl shadow-teal-500/15 relative group">
                  <canvas ref={heroCanvasRef} className="rounded-lg w-52 h-52 block" />
                  <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-300 font-mono text-[10px] border border-teal-500/30">
                    Frame {demoFrame + 1}/4
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs text-slate-400 font-mono">
                  <Zap className="w-3.5 h-3.5 text-teal-400" />
                  <span>384 Bytes/Frame @ 10 FPS = 3.8 KB/s</span>
                </div>
              </div>

              {/* Right: Optical Transmission Explanation */}
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-teal-400" />
                  How Optical File Transmission Works
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Traditional transfers require routing your files through Amazon S3, Google Cloud, or third-party relay servers.
                  BitBeam eliminates servers completely.
                </p>
                <div className="space-y-2.5 text-xs text-slate-300">
                  <div className="flex items-start gap-2.5 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                    <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                    <span><strong className="text-white">Zero Server Ingress:</strong> No HTTP upload API endpoints exist in BitBeam. Files cannot leave your browser.</span>
                  </div>
                  <div className="flex items-start gap-2.5 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                    <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                    <span><strong className="text-white">True Air-Gap Capability:</strong> Turn off Wi-Fi and Cellular on both devices — transfer still works flawlessly via photons.</span>
                  </div>
                  <div className="flex items-start gap-2.5 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                    <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                    <span><strong className="text-white">Cryptographic Verification:</strong> SHA-256 + CRC-32 ensure 100% bit-for-bit reconstruction fidelity.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 3 Step Workflow */}
        <div className="mt-20">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">Three Simple Steps</h2>
            <p className="text-slate-400 text-sm mt-1">From file on your computer to file on your phone in seconds</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Step 1 */}
            <div className="p-6 rounded-2xl bg-[#0e1524] border border-slate-800/80 hover:border-teal-500/40 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center mb-4 text-teal-400 font-mono font-bold text-lg group-hover:scale-110 transition-transform">
                01
              </div>
              <h3 className="text-lg font-bold text-white mb-2">1. Encode Locally</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Choose any file. Browser divides the binary buffer into CRC-32 protected chunks and animates them as high-density QR frames.
              </p>
            </div>

            {/* Step 2 */}
            <div className="p-6 rounded-2xl bg-[#0e1524] border border-slate-800/80 hover:border-cyan-500/40 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-4 text-cyan-400 font-mono font-bold text-lg group-hover:scale-110 transition-transform">
                02
              </div>
              <h3 className="text-lg font-bold text-white mb-2">2. Scan with Camera</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Open BitBeam on the receiving phone or laptop. Point camera at the screen to capture frames sequentially or out-of-order.
              </p>
            </div>

            {/* Step 3 */}
            <div className="p-6 rounded-2xl bg-[#0e1524] border border-slate-800/80 hover:border-emerald-500/40 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4 text-emerald-400 font-mono font-bold text-lg group-hover:scale-110 transition-transform">
                03
              </div>
              <h3 className="text-lg font-bold text-white mb-2">3. Reconstruct & Save</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Receiver verifies the SHA-256 cryptographic hash, reassembles the binary Blob, and saves the exact file directly to your disk.
              </p>
            </div>
          </div>
        </div>

        {/* Privacy & Air-Gap Compliance Highlights */}
        <div className="mt-20 p-8 rounded-2xl bg-gradient-to-br from-teal-950/20 via-[#0e1524] to-cyan-950/20 border border-teal-500/30">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2 max-w-xl">
              <div className="flex items-center gap-2 text-teal-400 text-xs font-mono font-bold uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4" />
                <span>Zero Trust Architecture</span>
              </div>
              <h3 className="text-xl font-extrabold text-white">Your Files Never Touch The Internet</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Once the BitBeam web app is loaded (or installed as a PWA), all transfers work completely offline.
                No third-party cookies, no tracking telemetry, no telemetry servers, and no server-side retention.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 shrink-0">
              <button
                onClick={() => setActiveTab('privacy')}
                className="px-5 py-2.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-teal-300 border border-teal-500/30 transition-colors"
              >
                Inspect Privacy Model
              </button>
              <button
                onClick={() => setActiveTab('loopback')}
                className="px-5 py-2.5 rounded-lg text-xs font-semibold bg-teal-500 hover:bg-teal-400 text-slate-950 transition-colors"
              >
                Launch Loopback Lab
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
