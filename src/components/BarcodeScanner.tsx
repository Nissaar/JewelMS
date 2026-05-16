import React, { useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

interface BarcodeScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onScanError?: (errorMessage: string) => void;
}

const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onScanSuccess, onScanError }) => {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      "reader",
      { 
        fps: 10, 
        qrbox: { width: 280, height: 180 },
        rememberLastUsedCamera: true,
        aspectRatio: 1.0
      },
      /* verbose= */ false
    );

    const successCallback = (decodedText: string) => {
      onScanSuccess(decodedText);
    };

    scanner.render(successCallback, (error) => {
      // Standard scan errors are frequent (no barcode found in frame), so we usually don't want to alert them
      if (onScanError) {
        onScanError(error);
      }
    });

    scannerRef.current = scanner;

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(err => {
          console.warn("Failed to clear scanner on unmount:", err);
        });
      }
    };
  }, [onScanSuccess, onScanError]);

  return (
    <div className="w-full max-w-md mx-auto overflow-hidden rounded-[2rem] border-4 border-amber-400 bg-white shadow-2xl relative">
      <div id="reader" className="w-full"></div>
      <div className="absolute inset-0 pointer-events-none border-[40px] border-black/20"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-40 border-2 border-amber-500 rounded-xl pointer-events-none shadow-[0_0_0_100vmax_rgba(0,0,0,0.3)]">
        <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-amber-500"></div>
        <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-amber-500"></div>
        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-amber-500"></div>
        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-amber-500"></div>
      </div>
    </div>
  );
};

export default BarcodeScanner;
