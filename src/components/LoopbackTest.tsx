import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, CheckCircle2, ShieldCheck, Zap, AlertTriangle, Download, Sparkles, FileText } from 'lucide-react';
import confetti from 'canvas-confetti';
import { chunkBinaryData, BinaryChunk } from '../core/chunker';
import { calculateSha256 } from '../core/crypto';
import { generateSessionId, encodeMetadataPayload, encodeChunkPayload } from '../core/frame-encoder';
import { validateAndParseFrame } from '../core/frame-validator';
import { ChunkCollector } from '../core/chunk-collector';
import { reconstructFile, triggerFileDownload } from '../core/file-reconstructor';
import { renderQRToCanvas } from '../core/qr-renderer';
import { ReconstructedFile, TransferStats, MetadataFrame, ChunkFrame } from '../types/protocol';
import { formatBytes } from '../utils/format';

export const LoopbackTest: React.FC = () => {
  const [selectedPreset, setSelectedPreset] = useState<'sample_text' | 'sample_svg' | 'sample_binary'>('sample_svg');
  const [fileBytes, setFileBytes] = useState<Uint8Array>(new Uint8Array());
  const [fileName, setFileName] = useState('bitbeam-vector-badge.svg');
  const [mimeType, setMimeType] = useState('image/svg+xml');
  const [sha256, setSha256] = useState<string>('');

  // Simulation controls
  const [fps, setFps] = useState(12);
  const [packetLossRate, setPacketLossRate] = useState(0); // 0% to 50% simulated dropped frames
  const [isRunning, setIsRunning] = useState(false);

  // Transfer state
  const [frames, setFrames] = useState<string[]>([]);
  const [currentFrameIdx, setCurrentFrameIdx] = useState(0);
  const [stats, setStats] = useState<TransferStats | null>(null);
  const [chunkBitmask, setChunkBitmask] = useState<boolean[]>([]);
  const [reconstructed, setReconstructed] = useState<ReconstructedFile | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const collectorRef = useRef<ChunkCollector>(new ChunkCollector());
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize presets
  useEffect(() => {
    loadPreset(selectedPreset);
  }, [selectedPreset]);

  const loadPreset = async (preset: 'sample_text' | 'sample_svg' | 'sample_binary') => {
    setIsRunning(false);
    collectorRef.current.reset();
    setReconstructed(null);
    setStats(null);
    setChunkBitmask([]);
    setCurrentFrameIdx(0);

    let bytes: Uint8Array;
    let name: string;
    let mime: string;

    if (preset === 'sample_text') {
      name = 'manifesto.txt';
      mime = 'text/plain';
      const text = `BitBeam Protocol Manifesto
==========================
Data should move through photons, not central servers.
Zero telemetry. Zero server-side persistence.
Every frame is verified by 32-bit CRC.
Full transmission is cryptographically verified by SHA-256.
Privacy is an architectural guarantee, not a policy promise.`;
      bytes = new TextEncoder().encode(text);
    } else if (preset === 'sample_svg') {
      name = 'bitbeam-vector-badge.svg';
      mime = 'image/svg+xml';
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#00f5c4" />
      <stop offset="100%" stop-color="#00e5ff" />
    </linearGradient>
  </defs>
  <rect width="400" height="400" fill="#080c14" rx="32" />
  <circle cx="200" cy="200" r="120" fill="url(#grad)" opacity="0.15" />
  <path d="M140 140 L260 140 L260 260 L140 260 Z" fill="none" stroke="url(#grad)" stroke-width="12" stroke-linejoin="round" />
  <path d="M170 170 L230 170 L230 230 L170 230 Z" fill="url(#grad)" />
  <text x="200" y="320" font-family="sans-serif" font-weight="bold" font-size="20" fill="#00f5c4" text-anchor="middle">BITBEAM VERIFIED</text>
</svg>`;
      bytes = new TextEncoder().encode(svg);
    } else {
      name = 'crypto_payload.bin';
      mime = 'application/octet-stream';
      // 8KB pseudo-random binary data
      bytes = new Uint8Array(8192);
      for (let i = 0; i < bytes.length; i++) {
        bytes[i] = (i * 37 + 19) % 256;
      }
    }

    setFileBytes(bytes);
    setFileName(name);
    setMimeType(mime);

    const hash = await calculateSha256(bytes);
    setSha256(hash);

    // Prepare frames
    const chunkSize = 256;
    const binaryChunks = chunkBinaryData(bytes, chunkSize);
    const sessionId = generateSessionId();

    const metaPayload = encodeMetadataPayload({
      sessionId,
      totalChunks: binaryChunks.length,
      fileSize: bytes.byteLength,
      sha256: hash,
      mimeType: mime,
      fileName: name
    });

    const generated: string[] = [metaPayload];
    binaryChunks.forEach((c: BinaryChunk) => {
      generated.push(encodeChunkPayload({
        sessionId,
        chunk: c,
        totalChunks: binaryChunks.length
      }));
    });

    setFrames(generated);
  };

  // Run the Loopback Pipe
  useEffect(() => {
    if (!isRunning || frames.length === 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const intervalMs = Math.round(1000 / fps);
    timerRef.current = setInterval(async () => {
      setCurrentFrameIdx(prev => {
        const nextIdx = (prev + 1) % frames.length;
        const payload = frames[nextIdx];

        // Draw sender QR
        if (canvasRef.current) {
          renderQRToCanvas(canvasRef.current, payload, {
            width: 260,
            margin: 2,
            errorCorrectionLevel: 'M',
            darkColor: '#000000',
            lightColor: '#ffffff'
          }).catch(() => {});
        }

        // Simulate optical reception
        // Apply simulated packet loss
        const shouldDrop = Math.random() < (packetLossRate / 100);
        if (!shouldDrop) {
          const parsed = validateAndParseFrame(payload);
          if (parsed.valid && parsed.frame) {
            const collector = collectorRef.current;
            if (parsed.frame.type === 'M') {
              collector.ingestMetadata(parsed.frame as MetadataFrame);
            } else if (parsed.frame.type === 'D') {
              const res = collector.ingestChunk(parsed.frame as ChunkFrame);
              if (res.isComplete && !reconstructed) {
                // Reconstruct
                const ordered = collector.getOrderedChunks();
                const meta = collector.getMetadata()!;
                reconstructFile(ordered, meta).then(rebuilt => {
                  setReconstructed(rebuilt);
                  setIsRunning(false);
                  confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
                }).catch(() => {});
              }
            }
            setStats(collector.getStats());
            setChunkBitmask(collector.getChunkBitmask());
          }
        }

        return nextIdx;
      });
    }, intervalMs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, frames, fps, packetLossRate, reconstructed]);

  const handleCustomUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      setFileBytes(bytes);
      setFileName(file.name);
      setMimeType(file.type || 'application/octet-stream');
      const hash = await calculateSha256(bytes);
      setSha256(hash);

      const chunkSize = 256;
      const binaryChunks = chunkBinaryData(bytes, chunkSize);
      const sessionId = generateSessionId();

      const metaPayload = encodeMetadataPayload({
        sessionId,
        totalChunks: binaryChunks.length,
        fileSize: bytes.byteLength,
        sha256: hash,
        mimeType: file.type || 'application/octet-stream',
        fileName: file.name
      });

      const generated: string[] = [metaPayload];
      binaryChunks.forEach((c: BinaryChunk) => {
        generated.push(encodeChunkPayload({
          sessionId,
          chunk: c,
          totalChunks: binaryChunks.length
        }));
      });

      setFrames(generated);
      collectorRef.current.reset();
      setReconstructed(null);
      setStats(null);
      setChunkBitmask([]);
      setCurrentFrameIdx(0);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-6 border-b border-slate-800 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center gap-3">
            <span>Loopback Test Workbench</span>
            <span className="text-xs px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-300 font-mono border border-purple-500/30">
              Lab Pipe
            </span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Test and verify the optical QR pipeline in a single browser window without a second device
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              collectorRef.current.reset();
              setReconstructed(null);
              setStats(null);
              setChunkBitmask([]);
              setCurrentFrameIdx(0);
            }}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-mono transition-colors"
          >
            Reset Test
          </button>
        </div>
      </div>

      {/* Preset Selector */}
      <div className="mt-8 p-4 rounded-xl bg-[#0e1524] border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-slate-400">Select Test Asset:</span>
          {(['sample_svg', 'sample_text', 'sample_binary'] as const).map(p => (
            <button
              key={p}
              onClick={() => setSelectedPreset(p)}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                selectedPreset === p
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 font-bold'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {p === 'sample_svg' ? 'SVG Badge' : p === 'sample_text' ? 'Text Manifesto' : '8KB Binary'}
            </button>
          ))}
        </div>

        <label className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-mono cursor-pointer border border-slate-700 transition-colors">
          Upload Custom File
          <input type="file" onChange={handleCustomUpload} className="hidden" />
        </label>
      </div>

      {/* Side-by-Side Optical Simulation Grid */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: Sender Simulation */}
        <div className="p-6 rounded-2xl bg-[#090d16] border border-slate-800 flex flex-col items-center justify-between">
          <div className="w-full flex items-center justify-between mb-4">
            <span className="text-xs font-mono uppercase text-teal-400 font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-teal-400" />
              Optical Sender
            </span>
            <span className="text-xs font-mono text-slate-400">
              Frame {currentFrameIdx + 1} / {frames.length}
            </span>
          </div>

          <div className="p-3 bg-white rounded-xl shadow-xl my-4">
            <canvas ref={canvasRef} className="block w-52 h-52 rounded" />
          </div>

          <div className="w-full text-xs font-mono text-slate-400 space-y-1">
            <div className="flex justify-between">
              <span>File:</span>
              <span className="text-white truncate max-w-[180px]">{fileName}</span>
            </div>
            <div className="flex justify-between">
              <span>Size:</span>
              <span className="text-white">{formatBytes(fileBytes.byteLength)}</span>
            </div>
            <div className="flex justify-between">
              <span>SHA-256:</span>
              <span className="text-teal-400">{sha256.slice(0, 12)}...</span>
            </div>
          </div>
        </div>

        {/* Right: Receiver Simulation */}
        <div className="p-6 rounded-2xl bg-[#090d16] border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-mono uppercase text-cyan-400 font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                Optical Receiver
              </span>
              <span className="text-xs font-mono text-cyan-400 font-bold">
                {stats ? `${stats.progressPercent}%` : '0%'}
              </span>
            </div>

            {/* Progress bar */}
            <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden mb-4">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-purple-400 transition-all duration-100"
                style={{ width: `${stats ? stats.progressPercent : 0}%` }}
              />
            </div>

            {/* Telemetry stats */}
            <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono mb-4">
              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <span className="text-slate-500 text-[10px] block">Chunks</span>
                <span className="text-emerald-400 font-bold">
                  {stats ? `${stats.receivedChunks}/${stats.totalChunks}` : '0/0'}
                </span>
              </div>
              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <span className="text-slate-500 text-[10px] block">Rate</span>
                <span className="text-white font-bold">{fps} FPS</span>
              </div>
              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <span className="text-slate-500 text-[10px] block">Duplicates</span>
                <span className="text-slate-400 font-bold">{stats ? stats.duplicateChunks : 0}</span>
              </div>
            </div>

            {/* Chunk Defragmentation Matrix */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-mono text-slate-400">Memory Chunk Matrix:</span>
              <div className="p-2 bg-slate-950 rounded-xl border border-slate-800 max-h-28 overflow-y-auto flex flex-wrap gap-1">
                {chunkBitmask.map((received, i) => (
                  <div
                    key={i}
                    className={`w-3 h-3 rounded-sm ${
                      received ? 'bg-cyan-400 shadow-[0_0_5px_#22d3ee]' : 'bg-slate-800'
                    }`}
                    title={`Chunk #${i + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Reconstruction status */}
          <div className="mt-4 pt-4 border-t border-slate-800">
            {reconstructed ? (
              <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40">
                <div className="flex items-center gap-2 text-emerald-400 text-xs font-mono">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Bit-for-Bit Verified!</span>
                </div>
                <button
                  onClick={() => triggerFileDownload(reconstructed)}
                  className="px-3 py-1 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Save</span>
                </button>
              </div>
            ) : (
              <div className="text-center text-xs text-slate-500 font-mono">
                {isRunning ? 'Capturing optical chunks...' : 'Click "Start Simulation" below'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Simulation Controls & Packet Glitch Tool */}
      <div className="mt-6 p-5 rounded-2xl bg-[#0e1524] border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsRunning(!isRunning)}
            className={`px-6 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all ${
              isRunning
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'bg-purple-500 hover:bg-purple-400 text-slate-950 shadow-lg shadow-purple-500/20'
            }`}
          >
            {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            <span>{isRunning ? 'Pause Lab' : 'Start Simulation'}</span>
          </button>

          <button
            onClick={() => {
              collectorRef.current.reset();
              setReconstructed(null);
              setStats(null);
              setChunkBitmask([]);
              setCurrentFrameIdx(0);
              setIsRunning(true);
            }}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
            title="Restart"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Speed Slider */}
        <div className="flex items-center gap-3 text-xs font-mono">
          <span className="text-slate-400">FPS: {fps}</span>
          <input
            type="range"
            min="3"
            max="30"
            value={fps}
            onChange={(e) => setFps(parseInt(e.target.value, 10))}
            className="w-28 accent-purple-400"
          />
        </div>

        {/* Packet Loss Glitch Simulator */}
        <div className="flex items-center gap-3 text-xs font-mono">
          <span className="text-slate-400 flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Drop Glitch: {packetLossRate}%</span>
          </span>
          <input
            type="range"
            min="0"
            max="40"
            value={packetLossRate}
            onChange={(e) => setPacketLossRate(parseInt(e.target.value, 10))}
            className="w-24 accent-amber-400"
            title="Simulate camera frame drops or lens blur"
          />
        </div>
      </div>
    </div>
  );
};
