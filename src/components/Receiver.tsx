import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Camera, CameraOff, RefreshCw, Download, CheckCircle2, 
  AlertTriangle, Flashlight, SwitchCamera, Sparkles, 
  Eye, FileText, Hash, ShieldCheck, QrCode, X, Play
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { QRScanner, QRScanResult } from '../core/qr-scanner';
import { validateAndParseFrame } from '../core/frame-validator';
import { ChunkCollector } from '../core/chunk-collector';
import { reconstructFile, triggerFileDownload, IntegrityVerificationError } from '../core/file-reconstructor';
import { renderQRToCanvas } from '../core/qr-renderer';
import { encodeRetransmitPayload } from '../core/frame-encoder';
import { ReconstructedFile, TransferStats, TransferMetadata } from '../types/protocol';
import { formatBytes } from '../utils/format';

export const Receiver: React.FC = () => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);

  // Transfer State
  const [metadata, setMetadata] = useState<TransferMetadata | null>(null);
  const [stats, setStats] = useState<TransferStats | null>(null);
  const [chunkBitmask, setChunkBitmask] = useState<boolean[]>([]);
  const [lastDecodedFrameInfo, setLastDecodedFrameInfo] = useState<string | null>(null);
  const [reconstructedFile, setReconstructedFile] = useState<ReconstructedFile | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [isReconstructing, setIsReconstructing] = useState(false);

  // Missing frame QR modal
  const [showMissingQR, setShowMissingQR] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerRef = useRef<QRScanner | null>(null);
  const collectorRef = useRef<ChunkCollector>(new ChunkCollector());
  const missingCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Initialize QRScanner instance
  useEffect(() => {
    scannerRef.current = new QRScanner();
    return () => {
      scannerRef.current?.stop();
    };
  }, []);

  // Frame decoded callback
  const handleFrameDecoded = useCallback(async (result: QRScanResult) => {
    const raw = result.data;
    if (!raw) return;

    const validation = validateAndParseFrame(raw);
    if (!validation.valid || !validation.frame) {
      // Ignore foreign/unrelated QR codes
      return;
    }

    const frame = validation.frame;
    const collector = collectorRef.current;

    if (frame.type === 'M') {
      const { accepted } = collector.ingestMetadata(frame);
      if (accepted) {
        setMetadata(collector.getMetadata());
      }
      setLastDecodedFrameInfo(`Metadata: ${frame.fileName} (${frame.totalChunks} frames)`);
    } else if (frame.type === 'D') {
      const res = collector.ingestChunk(frame);
      setLastDecodedFrameInfo(
        res.isDuplicate 
          ? `Frame #${frame.chunkIndex + 1} (Duplicate)` 
          : `Frame #${frame.chunkIndex + 1} of ${frame.totalChunks}`
      );

      // Check if complete
      if (res.isComplete && !reconstructedFile && !isReconstructing) {
        setIsReconstructing(true);
        try {
          const ordered = collector.getOrderedChunks();
          const meta = collector.getMetadata();
          if (meta) {
            const rebuilt = await reconstructFile(ordered, meta);
            setReconstructedFile(rebuilt);
            setIsScanning(false);
            scannerRef.current?.stop();

            // Trigger victory confetti!
            confetti({
              particleCount: 80,
              spread: 70,
              origin: { y: 0.6 }
            });
          }
        } catch (err: unknown) {
          if (err instanceof IntegrityVerificationError) {
            setVerificationError(`Checksum mismatch: expected ${err.expected.slice(0, 10)}... got ${err.actual.slice(0, 10)}...`);
          } else {
            setVerificationError(err instanceof Error ? err.message : 'Reconstruction failed');
          }
        } finally {
          setIsReconstructing(false);
        }
      }
    }

    // Refresh telemetry stats
    setStats(collector.getStats());
    setChunkBitmask(collector.getChunkBitmask());
  }, [reconstructedFile, isReconstructing]);

  // Start Camera
  const startCamera = async () => {
    setCameraError(null);
    setVerificationError(null);
    if (!videoRef.current || !scannerRef.current) return;

    try {
      await scannerRef.current.start(videoRef.current, handleFrameDecoded, {
        facingMode: 'environment'
      });
      setHasPermission(true);
      setIsScanning(true);
    } catch (err: unknown) {
      setHasPermission(false);
      setIsScanning(false);
      if (err instanceof DOMException) {
        if (err.name === 'NotAllowedError') {
          setCameraError('Camera access was denied. Please allow camera permissions in your browser settings.');
        } else if (err.name === 'NotFoundError') {
          setCameraError('No camera found on this device.');
        } else {
          setCameraError(`Camera error: ${err.message}`);
        }
      } else {
        setCameraError('Failed to access camera.');
      }
    }
  };

  // Stop Camera
  const stopCamera = () => {
    scannerRef.current?.stop();
    setIsScanning(false);
    setIsTorchOn(false);
  };

  // Toggle Camera
  const toggleCamera = async () => {
    if (!scannerRef.current) return;
    try {
      await scannerRef.current.toggleCamera();
    } catch {
      // ignore
    }
  };

  // Toggle Flashlight / Torch
  const toggleTorch = async () => {
    if (!scannerRef.current) return;
    const state = await scannerRef.current.toggleTorch();
    setIsTorchOn(state);
  };

  // Reset transfer
  const resetTransfer = () => {
    collectorRef.current.reset();
    setMetadata(null);
    setStats(null);
    setChunkBitmask([]);
    setLastDecodedFrameInfo(null);
    setReconstructedFile(null);
    setVerificationError(null);
    setIsReconstructing(false);
    if (!isScanning) {
      startCamera();
    }
  };

  // Render Missing Frames QR code
  useEffect(() => {
    if (showMissingQR && missingCanvasRef.current && stats && collectorRef.current.getSessionId()) {
      const sessionId = collectorRef.current.getSessionId()!;
      const missingPayload = encodeRetransmitPayload(sessionId, stats.missingChunks);
      renderQRToCanvas(missingCanvasRef.current, missingPayload, {
        width: 260,
        margin: 2,
        errorCorrectionLevel: 'M',
        darkColor: '#000000',
        lightColor: '#ffffff'
      }).catch(() => {});
    }
  }, [showMissingQR, stats]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Title & Privacy assurance */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-6 border-b border-slate-800 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center gap-3">
            <span>Receive File via Light</span>
            <span className="text-xs px-2.5 py-1 rounded-full bg-cyan-500/10 text-cyan-300 font-mono border border-cyan-500/30">
              Optical Rx
            </span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Point camera at the animated QR sequence on the sender screen
          </p>
        </div>

        <div className="flex items-center gap-2">
          {metadata && (
            <button
              onClick={resetTransfer}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-mono transition-colors"
            >
              Reset Session
            </button>
          )}
        </div>
      </div>

      {/* Main Grid: Camera Viewfinder & Real-Time Stats */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Camera Stage */}
        <div className="lg:col-span-7 space-y-4">
          <div className="relative rounded-2xl bg-[#090d16] border border-slate-800 overflow-hidden shadow-2xl aspect-[4/3] flex items-center justify-center">
            {/* The Video Element */}
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              muted
              playsInline
            />

            {/* Target Reticle & Scanline Overlay */}
            {isScanning && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                {/* Outer frame */}
                <div className="relative w-64 h-64 sm:w-72 sm:h-72 border-2 border-dashed border-cyan-400/60 rounded-2xl">
                  {/* Corner brackets */}
                  <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-cyan-400 rounded-tl-lg" />
                  <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-cyan-400 rounded-tr-lg" />
                  <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-cyan-400 rounded-bl-lg" />
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-cyan-400 rounded-br-lg" />

                  {/* Animated laser scanline */}
                  <div className="absolute inset-x-2 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_15px_#22d3ee] animate-scanline" />
                </div>
              </div>
            )}

            {/* Inactive State Overlay */}
            {!isScanning && !reconstructedFile && (
              <div className="absolute inset-0 bg-[#090d16]/95 flex flex-col items-center justify-center p-6 text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <Camera className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Camera Access Required</h3>
                  <p className="text-xs text-slate-400 max-w-sm mt-1">
                    BitBeam decodes optical QR light entirely inside your browser. No video is ever stored or transmitted.
                  </p>
                </div>
                <button
                  onClick={startCamera}
                  className="px-6 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-sm transition-all shadow-lg shadow-cyan-500/20"
                >
                  Start Scanning
                </button>
              </div>
            )}

            {/* Top Camera Controls Overlay */}
            {isScanning && (
              <div className="absolute top-4 inset-x-4 flex items-center justify-between pointer-events-auto">
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md border border-slate-700/60 text-xs font-mono text-cyan-400">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                  <span>DECODING</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleTorch}
                    className={`p-2 rounded-xl backdrop-blur-md border transition-colors ${
                      isTorchOn
                        ? 'bg-amber-400/30 text-amber-300 border-amber-400/50'
                        : 'bg-black/60 text-slate-300 border-slate-700/60 hover:text-white'
                    }`}
                    title="Toggle Flashlight / Torch"
                  >
                    <Flashlight className="w-4 h-4" />
                  </button>

                  <button
                    onClick={toggleCamera}
                    className="p-2 rounded-xl bg-black/60 backdrop-blur-md text-slate-300 border border-slate-700/60 hover:text-white transition-colors"
                    title="Switch Front/Rear Camera"
                  >
                    <SwitchCamera className="w-4 h-4" />
                  </button>

                  <button
                    onClick={stopCamera}
                    className="p-2 rounded-xl bg-black/60 backdrop-blur-md text-rose-300 border border-slate-700/60 hover:bg-rose-950/40 transition-colors"
                    title="Stop Camera"
                  >
                    <CameraOff className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Bottom decoded pill overlay */}
            {isScanning && lastDecodedFrameInfo && (
              <div className="absolute bottom-4 inset-x-4 flex justify-center pointer-events-none">
                <div className="px-3 py-1 rounded-full bg-black/70 backdrop-blur-md border border-slate-700 text-slate-200 text-xs font-mono truncate max-w-sm">
                  {lastDecodedFrameInfo}
                </div>
              </div>
            )}
          </div>

          {/* Camera Error Message */}
          {cameraError && (
            <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
              <div>
                <p className="font-semibold">Camera Access Error</p>
                <p className="text-rose-300/80 mt-0.5">{cameraError}</p>
                <button
                  onClick={startCamera}
                  className="mt-2 text-cyan-400 underline font-semibold text-xs"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}

          {/* Verification Error */}
          {verificationError && (
            <div className="p-4 rounded-xl bg-rose-950/50 border border-rose-700 text-rose-200 text-xs flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
              <div>
                <p className="font-bold text-rose-300">File Integrity Verification Failed</p>
                <p className="text-rose-300/80 mt-0.5">{verificationError}</p>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Real-time Telemetry & Chunk Matrix */}
        <div className="lg:col-span-5 space-y-6">
          {/* Metadata Card */}
          <div className="p-5 rounded-2xl bg-[#0e1524] border border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center justify-between">
              <span>Incoming Transfer Metadata</span>
              {metadata ? (
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  Active Link
                </span>
              ) : (
                <span className="text-[11px] font-mono text-slate-500">
                  Waiting for Frame...
                </span>
              )}
            </h3>

            {metadata ? (
              <div className="space-y-3 text-xs">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                  <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="overflow-hidden">
                    <p className="font-semibold text-white truncate">{metadata.fileName}</p>
                    <p className="text-slate-400 font-mono text-[11px]">{formatBytes(metadata.fileSize)} • {metadata.mimeType}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                  <div className="p-2.5 rounded-lg bg-slate-900/50 border border-slate-800">
                    <span className="text-slate-500 block">Total Chunks</span>
                    <span className="text-white font-bold text-sm">{metadata.totalChunks} frames</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900/50 border border-slate-800">
                    <span className="text-slate-500 block">Session ID</span>
                    <span className="text-cyan-400 font-bold text-sm">{metadata.sessionId}</span>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-900/50 border border-slate-800 text-[10px] font-mono text-slate-400 break-all">
                  <span className="text-slate-500 block mb-0.5">Target SHA-256 Checksum:</span>
                  <span className="text-slate-300">{metadata.sha256}</span>
                </div>
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-slate-500">
                Point camera at sender screen to read file metadata
              </div>
            )}
          </div>

          {/* Progress & Live Telemetry */}
          {stats && (
            <div className="p-5 rounded-2xl bg-[#0e1524] border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Transfer Telemetry</h4>
                <div className="text-cyan-400 font-mono font-bold text-sm">
                  {stats.progressPercent}%
                </div>
              </div>

              {/* Progress bar */}
              <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-teal-400 transition-all duration-150"
                  style={{ width: `${stats.progressPercent}%` }}
                />
              </div>

              {/* Grid metrics */}
              <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
                <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                  <span className="text-slate-500 text-[10px] block">Received</span>
                  <span className="text-emerald-400 font-bold">{stats.receivedChunks}/{stats.totalChunks}</span>
                </div>
                <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                  <span className="text-slate-500 text-[10px] block">Speed</span>
                  <span className="text-white font-bold">{stats.fps} FPS</span>
                </div>
                <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                  <span className="text-slate-500 text-[10px] block">Duplicates</span>
                  <span className="text-slate-400 font-bold">{stats.duplicateChunks}</span>
                </div>
              </div>

              {/* Chunk Defragmentation Matrix Visualizer */}
              {chunkBitmask.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-slate-800">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                    <span>Chunk Map ({stats.receivedChunks}/{chunkBitmask.length})</span>
                    {stats.missingChunks.length > 0 && (
                      <button
                        onClick={() => setShowMissingQR(true)}
                        className="text-amber-400 hover:text-amber-300 underline"
                      >
                        Request {stats.missingChunks.length} Missing
                      </button>
                    )}
                  </div>

                  <div className="max-h-28 overflow-y-auto p-2 bg-[#080c14] rounded-xl border border-slate-800/80 flex flex-wrap gap-1">
                    {chunkBitmask.map((isReceived, i) => (
                      <div
                        key={i}
                        className={`w-3 h-3 rounded-sm text-[8px] flex items-center justify-center font-mono transition-colors ${
                          isReceived 
                            ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)]' 
                            : 'bg-slate-800 border border-slate-700/50'
                        }`}
                        title={`Chunk #${i + 1}: ${isReceived ? 'Received' : 'Pending'}`}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Reconstruction Success Modal / Card */}
      {reconstructedFile && (
        <div className="mt-8 p-6 sm:p-8 rounded-2xl bg-gradient-to-br from-emerald-950/40 via-[#0e1828] to-cyan-950/40 border-2 border-emerald-500/50 shadow-2xl space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    SHA-256 Verified (100% Match)
                  </span>
                </div>
                <h3 className="text-xl font-extrabold text-white mt-1">{reconstructedFile.name}</h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  Size: {formatBytes(reconstructedFile.size)} • Type: {reconstructedFile.mimeType}
                </p>
              </div>
            </div>

            <button
              onClick={() => triggerFileDownload(reconstructedFile)}
              className="px-6 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm shadow-xl shadow-emerald-500/25 flex items-center gap-2 transition-all transform hover:-translate-y-0.5"
            >
              <Download className="w-4 h-4" />
              <span>Save File</span>
            </button>
          </div>

          {/* Inline Media Preview if supported */}
          {reconstructedFile.mimeType.startsWith('image/') && (
            <div className="p-4 bg-[#080c14] rounded-xl border border-slate-800 text-center">
              <p className="text-xs text-slate-400 font-mono mb-2">Direct Local Preview</p>
              <img
                src={reconstructedFile.url}
                alt={reconstructedFile.name}
                className="max-h-72 mx-auto rounded-lg shadow-lg object-contain"
              />
            </div>
          )}

          {reconstructedFile.mimeType.startsWith('audio/') && (
            <div className="p-4 bg-[#080c14] rounded-xl border border-slate-800 text-center">
              <p className="text-xs text-slate-400 font-mono mb-2">Direct Audio Preview</p>
              <audio controls src={reconstructedFile.url} className="w-full max-w-md mx-auto" />
            </div>
          )}

          <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 flex items-center justify-between text-xs font-mono text-slate-400">
            <span>Verified Checksum:</span>
            <span className="text-emerald-400">{reconstructedFile.sha256}</span>
          </div>
        </div>
      )}

      {/* Missing Frames Reverse QR Modal */}
      {showMissingQR && stats && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0e1524] border border-slate-700 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl relative">
            <button
              onClick={() => setShowMissingQR(false)}
              className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center space-y-1">
              <h4 className="font-bold text-white text-base">Request Missing Frames</h4>
              <p className="text-xs text-slate-400">
                Show this QR to the sender or copy the missing indices below:
              </p>
            </div>

            <div className="p-3 bg-white rounded-xl shadow-lg w-fit mx-auto">
              <canvas ref={missingCanvasRef} className="block" />
            </div>

            <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 text-xs font-mono text-slate-300">
              <span className="text-slate-500 block mb-1">Missing frame indices:</span>
              <p className="break-all text-amber-400 font-semibold">{stats.missingChunks.join(', ')}</p>
            </div>

            <button
              onClick={() => setShowMissingQR(false)}
              className="w-full py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
