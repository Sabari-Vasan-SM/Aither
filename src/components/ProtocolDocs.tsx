import React from 'react';
import { BookOpen, ShieldCheck, Zap, Layers, Lock, Cpu, ServerOff } from 'lucide-react';

export const ProtocolDocs: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-12">
      {/* Title */}
      <div className="pb-6 border-b border-slate-800">
        <h1 className="text-3xl font-extrabold text-white flex items-center gap-3">
          <BookOpen className="w-8 h-8 text-teal-400" />
          <span>BitBeam Optical Protocol (BB1)</span>
        </h1>
        <p className="text-slate-400 text-sm mt-2">
          Technical specification for multi-frame optical QR transmission and local reconstruction
        </p>
      </div>

      {/* Overview */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Layers className="w-5 h-5 text-teal-400" />
          1. Architectural Overview
        </h2>
        <p className="text-slate-300 text-sm leading-relaxed">
          Standard QR codes were designed for static strings, URLs, or short credentials. A Version 40 QR code has a theoretical capacity of ~2,953 bytes in binary mode, but dense codes are notoriously difficult for smartphone lenses to scan at video rates.
        </p>
        <p className="text-slate-300 text-sm leading-relaxed">
          <strong>BitBeam solves this through a streaming multi-frame optical pipeline</strong>: files are split into small, medium-density binary chunks (default 384 bytes) wrapped with 32-bit CRC headers, animated across consecutive frames, and reconstructed with cryptographic SHA-256 validation.
        </p>
      </section>

      {/* Frame Structure Table */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Cpu className="w-5 h-5 text-cyan-400" />
          2. Frame Anatomy & Payloads
        </h2>

        <div className="space-y-6">
          {/* Metadata Frame */}
          <div className="p-5 rounded-xl bg-[#0e1524] border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-teal-400">Metadata Frame (Type: 'M')</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-teal-500/10 text-teal-300 border border-teal-500/30">Frame 0 & Interleaved</span>
            </div>
            <pre className="p-3 bg-[#080c14] rounded-lg text-xs font-mono text-emerald-300 overflow-x-auto border border-slate-800">
              BB1|M|sessionId|totalChunks|fileSize|sha256|mimeType|b64Name
            </pre>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-400">
              <div><strong className="text-white">BB1:</strong> Protocol Version 1</div>
              <div><strong className="text-white">sessionId:</strong> 8-char random session hex</div>
              <div><strong className="text-white">totalChunks:</strong> Integer chunk count</div>
              <div><strong className="text-white">fileSize:</strong> Exact file size in bytes</div>
              <div><strong className="text-white">sha256:</strong> 64-char lowercase SHA-256 hash</div>
              <div><strong className="text-white">b64Name:</strong> UTF-8 safe Base64 filename</div>
            </div>
          </div>

          {/* Chunk Frame */}
          <div className="p-5 rounded-xl bg-[#0e1524] border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-cyan-400">Data Chunk Frame (Type: 'D')</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">Data Frames 1..N</span>
            </div>
            <pre className="p-3 bg-[#080c14] rounded-lg text-xs font-mono text-cyan-300 overflow-x-auto border border-slate-800">
              BB1|D|sessionId|chunkIndex|totalChunks|crc32|b64Payload
            </pre>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-400">
              <div><strong className="text-white">chunkIndex:</strong> 0-based chunk sequence index</div>
              <div><strong className="text-white">totalChunks:</strong> Injected in each chunk for early sync</div>
              <div><strong className="text-white">crc32:</strong> 8-char hex CRC-32 of raw binary chunk</div>
              <div><strong className="text-white">b64Payload:</strong> Base64 encoded binary chunk</div>
            </div>
          </div>

          {/* Retransmit Frame */}
          <div className="p-5 rounded-xl bg-[#0e1524] border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-amber-400">Retransmission Request Frame (Type: 'R')</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30">Reverse Optical Link</span>
            </div>
            <pre className="p-3 bg-[#080c14] rounded-lg text-xs font-mono text-amber-300 overflow-x-auto border border-slate-800">
              BB1|R|sessionId|missingIndicesCSV
            </pre>
            <p className="text-xs text-slate-400">
              Receiver can generate this QR code containing comma-separated missing frame indices to command the sender to loop only those chunks.
            </p>
          </div>
        </div>
      </section>

      {/* Optical Bandwidth & Speeds */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Zap className="w-5 h-5 text-amber-400" />
          3. Optical Throughput Calculations
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border border-slate-800 rounded-xl overflow-hidden">
            <thead className="bg-[#0e1524] text-slate-300 font-mono">
              <tr>
                <th className="p-3 border-b border-slate-800">Chunk Size</th>
                <th className="p-3 border-b border-slate-800">Frame Rate</th>
                <th className="p-3 border-b border-slate-800">Optical Throughput</th>
                <th className="p-3 border-b border-slate-800">100 KB Transfer Time</th>
                <th className="p-3 border-b border-slate-800">1 MB Transfer Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-slate-300 font-mono">
              <tr className="hover:bg-slate-900/50">
                <td className="p-3 font-semibold text-white">256 Bytes</td>
                <td className="p-3">8 FPS</td>
                <td className="p-3 text-teal-400">~2.0 KB/s</td>
                <td className="p-3">~50 seconds</td>
                <td className="p-3">~8.3 minutes</td>
              </tr>
              <tr className="hover:bg-slate-900/50 bg-teal-500/5">
                <td className="p-3 font-semibold text-teal-300">384 Bytes (Recommended)</td>
                <td className="p-3">10 FPS</td>
                <td className="p-3 text-teal-400 font-bold">~3.8 KB/s</td>
                <td className="p-3 text-teal-300 font-bold">~26 seconds</td>
                <td className="p-3 text-teal-300">~4.3 minutes</td>
              </tr>
              <tr className="hover:bg-slate-900/50">
                <td className="p-3 font-semibold text-white">512 Bytes</td>
                <td className="p-3">15 FPS</td>
                <td className="p-3 text-cyan-400">~7.6 KB/s</td>
                <td className="p-3">~13 seconds</td>
                <td className="p-3">~2.1 minutes</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Comparison Matrix */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          4. Air-Gap Privacy Comparison
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border border-slate-800 rounded-xl overflow-hidden">
            <thead className="bg-[#0e1524] text-slate-300 font-mono">
              <tr>
                <th className="p-3 border-b border-slate-800">Transfer Vector</th>
                <th className="p-3 border-b border-slate-800">Server Logs?</th>
                <th className="p-3 border-b border-slate-800">Network Radio Required?</th>
                <th className="p-3 border-b border-slate-800">Metadata Leaks?</th>
                <th className="p-3 border-b border-slate-800">Air-Gap Integrity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-slate-300">
              <tr className="hover:bg-slate-900/50">
                <td className="p-3 font-semibold text-white">Cloud Storage (S3 / Drive)</td>
                <td className="p-3 text-rose-400">Yes (Server Storage)</td>
                <td className="p-3 text-rose-400">Yes (Internet)</td>
                <td className="p-3 text-rose-400">IP, filename, headers</td>
                <td className="p-3 text-rose-400">Zero</td>
              </tr>
              <tr className="hover:bg-slate-900/50">
                <td className="p-3 font-semibold text-white">WebRTC / Peer-to-Peer</td>
                <td className="p-3 text-amber-400">STUN/TURN signaling logs</td>
                <td className="p-3 text-amber-400">Yes (Local Wi-Fi or Internet)</td>
                <td className="p-3 text-amber-400">Local IP, SDP offers</td>
                <td className="p-3 text-amber-400">Partial</td>
              </tr>
              <tr className="hover:bg-slate-900/50 bg-emerald-500/5 font-semibold">
                <td className="p-3 text-emerald-300">BitBeam (Optical QR)</td>
                <td className="p-3 text-emerald-400">None (Zero Servers)</td>
                <td className="p-3 text-emerald-400">None (Pure Photons)</td>
                <td className="p-3 text-emerald-400">Zero (No radio packets)</td>
                <td className="p-3 text-emerald-400">100% Air-Gapped</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
