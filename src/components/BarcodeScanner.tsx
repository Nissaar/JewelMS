import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { createWorker } from 'tesseract.js';
import { Loader2, ScanFace, Barcode, Scan } from 'lucide-react';

interface BarcodeScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onScanError?: (errorMessage: string) => void;
}

const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onScanSuccess, onScanError }) => {
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const [ocrMode, setOcrMode] = useState<'barcode' | 'ocr'>('barcode');
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const workerRef = useRef<any>(null);
  const lastOcrTime = useRef<number>(0);
  const ocrBusy = useRef(false);
  const isActive = useRef<boolean>(true);
  // The latest callback, read at scan time, so the camera isn't restarted
  // every time the parent re-renders with a new inline function.
  const onScanRef = useRef(onScanSuccess);
  onScanRef.current = onScanSuccess;
  // The camera decodes ~10 frames per second: report each code once, not ten times.
  const lastScan = useRef<{ text: string; at: number }>({ text: '', at: 0 });

  const report = (text: string) => {
    const now = Date.now();
    if (text === lastScan.current.text && now - lastScan.current.at < 3000) return;
    lastScan.current = { text, at: now };
    onScanRef.current(text);
  };

  useEffect(() => {
    isActive.current = true;
    const html5QrCode = new Html5Qrcode("reader");
    html5QrCodeRef.current = html5QrCode;
    let started = false;

    const processOcr = async () => {
      if (!workerRef.current || ocrBusy.current || !isActive.current) return;
      const videoElement = document.querySelector("#reader video") as HTMLVideoElement;
      if (!videoElement) return;

      ocrBusy.current = true;
      setIsOcrProcessing(true);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(videoElement, 0, 0);
          const { data: { text } } = await workerRef.current.recognize(canvas);

          // Typical serial numbers or codes (alphanumeric, at least 4 chars), not tiny fragments.
          const codes = text.split(/\s+/).filter((s: string) => /^[A-Z0-9-]{4,20}$/.test(s));
          if (codes.length > 0 && isActive.current) {
            report(codes.reduce((a: string, b: string) => a.length > b.length ? a : b));
          }
        }
      } catch (err) {
        console.error("OCR error:", err);
      } finally {
        ocrBusy.current = false;
        if (isActive.current) setIsOcrProcessing(false);
      }
    };

    const init = async () => {
      // Start the camera first; the OCR engine loads in the background.
      try {
        await html5QrCode.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 280, height: 180 } },
          (decodedText) => { if (isActive.current) report(decodedText); },
          () => {
            // No barcode in this frame: try OCR at most every 5 seconds.
            const now = Date.now();
            if (now - lastOcrTime.current > 5000 && !ocrBusy.current) {
              lastOcrTime.current = now;
              processOcr();
            }
          }
        );
        started = true;
        // Unmounted while the camera was starting: stop it now.
        if (!isActive.current) await html5QrCode.stop().then(() => html5QrCode.clear()).catch(() => {});
      } catch (err) {
        console.error("Failed to start scanner:", err);
        onScanError?.(String(err));
      }

      try {
        const worker = await createWorker('eng');
        if (isActive.current) workerRef.current = worker;
        else await worker.terminate();
      } catch (err) {
        console.warn("OCR unavailable:", err);
      }
    };

    init();

    return () => {
      isActive.current = false;
      if (started) {
        html5QrCode.stop().then(() => html5QrCode.clear()).catch(err => console.warn(err));
      }
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  return (
    <div className="w-full max-w-md mx-auto overflow-hidden rounded-[2rem] border-4 border-amber-400 bg-white shadow-2xl relative">
      <div id="reader" className="w-full"></div>
      
      {/* Overlay UI */}
      <div className="absolute inset-0 pointer-events-none border-[40px] border-black/20"></div>
      
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-40 border-2 border-amber-500 rounded-xl pointer-events-none shadow-[0_0_0_100vmax_rgba(0,0,0,0.3)]">
        <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-amber-500"></div>
        <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-amber-500"></div>
        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-amber-500"></div>
        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-amber-500"></div>
      </div>

      {/* Status Bar */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-900/80 backdrop-blur px-4 py-2 rounded-full flex items-center gap-3 text-xs font-bold text-white shadow-lg pointer-events-none">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
          {isOcrProcessing ? (
            <>
              <Loader2 className="animate-spin text-amber-400" size={14} />
              <span>DÉTECTION OCR EN COURS...</span>
            </>
          ) : (
            <>
              <Scan size={14} className="text-amber-400" />
              <span>SCANNER HYBRIDE ACTIF (CODE-BARRES + TEXTE)</span>
            </>
          )}
        </div>
      </div>

      {/* Mode Indicator Hub */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 pointer-events-none">
        <div className="bg-white/90 backdrop-blur p-2 rounded-xl shadow-md border border-slate-100 flex items-center gap-2">
           <Barcode size={16} className="text-slate-600" />
           <div className="h-1.5 w-1.5 rounded-full bg-emerald-500"></div>
        </div>
        <div className="bg-white/90 backdrop-blur p-2 rounded-xl shadow-md border border-slate-100 flex items-center gap-2">
           <ScanFace size={16} className={isOcrProcessing ? "text-amber-500" : "text-slate-400"} />
           <div className={`h-1.5 w-1.5 rounded-full ${isOcrProcessing ? 'bg-amber-500 animate-ping' : 'bg-slate-200'}`}></div>
        </div>
      </div>
    </div>
  );
};

export default BarcodeScanner;
