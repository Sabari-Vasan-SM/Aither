/**
 * QR Scanner Module
 * Camera stream management, hardware flashlight control, and high-frequency QR frame decoding with jsQR
 */

import jsQR from 'jsqr';

export interface CameraDeviceInfo {
  deviceId: string;
  label: string;
}

export interface QRScanResult {
  data: string;
  location?: {
    topLeft: { x: number; y: number };
    topRight: { x: number; y: number };
    bottomRight: { x: number; y: number };
    bottomLeft: { x: number; y: number };
  };
}

export class QRScanner {
  private video: HTMLVideoElement | null = null;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private stream: MediaStream | null = null;
  private animationFrameId: number | null = null;
  private isScanning: boolean = false;
  private facingMode: 'environment' | 'user' = 'environment';
  private selectedDeviceId: string | null = null;
  private onFrameDecoded: ((result: QRScanResult) => void) | null = null;
  private torchEnabled: boolean = false;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
  }

  /**
   * Enumerate available video input devices
   */
  public async getAvailableCameras(): Promise<CameraDeviceInfo[]> {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      return [];
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices
        .filter(d => d.kind === 'videoinput')
        .map(d => ({
          deviceId: d.deviceId,
          label: d.label || `Camera ${d.deviceId.slice(0, 5)}`
        }));
    } catch {
      return [];
    }
  }

  /**
   * Starts camera capture and binds to the specified HTMLVideoElement
   */
  public async start(
    videoElement: HTMLVideoElement,
    callback: (result: QRScanResult) => void,
    options?: {
      deviceId?: string;
      facingMode?: 'environment' | 'user';
    }
  ): Promise<void> {
    this.stop(); // Stop any existing session
    this.video = videoElement;
    this.onFrameDecoded = callback;
    if (options?.facingMode) this.facingMode = options.facingMode;
    if (options?.deviceId) this.selectedDeviceId = options.deviceId;

    const constraints: MediaStreamConstraints = {
      audio: false,
      video: this.selectedDeviceId
        ? { deviceId: { exact: this.selectedDeviceId } }
        : {
            facingMode: { ideal: this.facingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
    };

    try {
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.video.srcObject = this.stream;
      this.video.setAttribute('playsinline', 'true'); // Required for iOS
      await this.video.play();
      this.isScanning = true;
      this.scheduleNextFrame();
    } catch (err: unknown) {
      this.stop();
      throw err;
    }
  }

  /**
   * Toggles between front and back camera
   */
  public async toggleCamera(): Promise<void> {
    if (!this.video || !this.onFrameDecoded) return;
    this.facingMode = this.facingMode === 'environment' ? 'user' : 'environment';
    this.selectedDeviceId = null;
    await this.start(this.video, this.onFrameDecoded, { facingMode: this.facingMode });
  }

  /**
   * Switch to a specific device by ID
   */
  public async switchDevice(deviceId: string): Promise<void> {
    if (!this.video || !this.onFrameDecoded) return;
    this.selectedDeviceId = deviceId;
    await this.start(this.video, this.onFrameDecoded, { deviceId });
  }

  /**
   * Toggle camera torch / flashlight if supported
   */
  public async toggleTorch(): Promise<boolean> {
    if (!this.stream) return false;
    const track = this.stream.getVideoTracks()[0];
    if (!track) return false;

    const capabilities = (track.getCapabilities?.()) as { torch?: boolean } | undefined;
    if (!capabilities?.torch) {
      return false;
    }

    try {
      this.torchEnabled = !this.torchEnabled;
      await track.applyConstraints({
        advanced: [{ torch: this.torchEnabled } as MediaTrackConstraintSet]
      });
      return this.torchEnabled;
    } catch {
      this.torchEnabled = false;
      return false;
    }
  }

  public isTorchOn(): boolean {
    return this.torchEnabled;
  }

  /**
   * Continuous scanning loop using requestAnimationFrame
   */
  private scheduleNextFrame = (): void => {
    if (!this.isScanning) return;
    this.animationFrameId = requestAnimationFrame(this.scanFrame);
  };

  private scanFrame = (): void => {
    if (!this.isScanning || !this.video || !this.ctx) return;

    if (this.video.readyState === this.video.HAVE_ENOUGH_DATA) {
      const vWidth = this.video.videoWidth;
      const vHeight = this.video.videoHeight;

      if (vWidth > 0 && vHeight > 0) {
        // Optimize resolution: scale down if video is larger than 720p for faster decoding
        const maxDimension = 640;
        let scale = 1;
        if (Math.max(vWidth, vHeight) > maxDimension) {
          scale = maxDimension / Math.max(vWidth, vHeight);
        }

        const scanWidth = Math.floor(vWidth * scale);
        const scanHeight = Math.floor(vHeight * scale);

        if (this.canvas.width !== scanWidth || this.canvas.height !== scanHeight) {
          this.canvas.width = scanWidth;
          this.canvas.height = scanHeight;
        }

        this.ctx.drawImage(this.video, 0, 0, scanWidth, scanHeight);
        const imageData = this.ctx.getImageData(0, 0, scanWidth, scanHeight);

        // Run jsQR
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'attemptBoth'
        });

        if (code && code.data && this.onFrameDecoded) {
          this.onFrameDecoded({
            data: code.data,
            location: code.location
              ? {
                  topLeft: { x: code.location.topLeftCorner.x / scale, y: code.location.topLeftCorner.y / scale },
                  topRight: { x: code.location.topRightCorner.x / scale, y: code.location.topRightCorner.y / scale },
                  bottomRight: { x: code.location.bottomRightCorner.x / scale, y: code.location.bottomRightCorner.y / scale },
                  bottomLeft: { x: code.location.bottomLeftCorner.x / scale, y: code.location.bottomLeftCorner.y / scale }
                }
              : undefined
          });
        }
      }
    }

    this.scheduleNextFrame();
  };

  /**
   * Completely stops video streams and releases camera hardware
   */
  public stop(): void {
    this.isScanning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => {
        track.stop();
      });
      this.stream = null;
    }

    if (this.video) {
      this.video.srcObject = null;
      this.video = null;
    }

    this.torchEnabled = false;
    this.onFrameDecoded = null;
  }
}
