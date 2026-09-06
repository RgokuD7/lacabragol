import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, AlertCircle, Sparkles } from 'lucide-react';

interface QuickQRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
  title?: string;
}

export function QuickQRScannerModal({
  isOpen,
  onClose,
  onScan,
  title = 'Escanear Código QR'
}: QuickQRScannerModalProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isStoppingRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      setErrorMessage(null);
      setIsInitializing(true);
      return;
    }

    let isMounted = true;
    const elementId = 'instant-qr-reader-target';

    const startScanner = async () => {
      try {
        setIsInitializing(true);
        setErrorMessage(null);
        isStoppingRef.current = false;

        // Small delay to ensure the DOM element is rendered and sized
        await new Promise((res) => setTimeout(res, 80));
        if (!isMounted) return;

        const html5QrCode = new Html5Qrcode(elementId);
        scannerRef.current = html5QrCode;

        const config = {
          fps: 15,
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            const size = Math.floor(minEdge * 0.75);
            return { width: Math.max(200, size), height: Math.max(200, size) };
          },
          aspectRatio: 1.0,
        };

        const handleSuccess = async (decodedText: string) => {
          if (isStoppingRef.current) return;
          isStoppingRef.current = true;

          // Extract invite code if URL is scanned
          let code = decodedText.trim();
          try {
            if (code.includes('?invite=')) {
              const url = new URL(code);
              const param = url.searchParams.get('invite');
              if (param) code = param;
            } else if (code.includes('/invite/')) {
              const parts = code.split('/invite/');
              if (parts[1]) code = parts[1].split(/[?#&]/)[0];
            }
          } catch {
            // Keep raw code if URL parsing fails
          }

          code = code.trim().toUpperCase();

          // Stop scanner cleanly
          try {
            if (html5QrCode.isScanning) {
              await html5QrCode.stop();
              await html5QrCode.clear();
            }
          } catch (e) {
            console.warn('Error stopping scanner:', e);
          }

          onScan(code);
          onClose();
        };

        // Try environment camera first
        try {
          await html5QrCode.start(
            { facingMode: 'environment' },
            config,
            handleSuccess,
            () => {} // silent frame parsing
          );
        } catch (firstErr) {
          // Fallback to any camera available (e.g. desktop webcam)
          if (!isMounted) return;
          console.warn('Environment camera failed, falling back to any camera', firstErr);
          await html5QrCode.start(
            { facingMode: 'user' },
            config,
            handleSuccess,
            () => {}
          );
        }

        if (isMounted) {
          setIsInitializing(false);
        }
      } catch (err: any) {
        console.error('Camera start error:', err);
        if (isMounted) {
          setIsInitializing(false);
          setErrorMessage(
            err?.message?.includes('NotAllowedError') || err?.name === 'NotAllowedError'
              ? 'Permiso de cámara denegado. Permite el acceso para escanear.'
              : 'No se pudo acceder a la cámara. Revisa los permisos del navegador.'
          );
        }
      }
    };

    startScanner();

    return () => {
      isMounted = false;
      if (scannerRef.current) {
        const instance = scannerRef.current;
        scannerRef.current = null;
        if (instance.isScanning) {
          instance.stop().then(() => instance.clear()).catch(() => {});
        } else {
          try {
            instance.clear();
          } catch {}
        }
      }
    };
  }, [isOpen, onClose, onScan]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-sm bg-[#121215] border border-zinc-800 rounded-3xl p-5 shadow-2xl overflow-hidden flex flex-col items-center text-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center border border-zinc-700/60 transition-colors"
          title="Cerrar escáner"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <Camera className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-black text-white uppercase tracking-wider">{title}</h3>
        </div>

        <p className="text-xs text-zinc-400 mb-4 max-w-xs leading-relaxed">
          Apunta con la cámara hacia el código QR de invitación al grupo.
        </p>

        {/* Camera Container */}
        <div className="relative w-full aspect-square max-w-[280px] bg-black rounded-2xl overflow-hidden border-2 border-blue-500/40 shadow-inner flex items-center justify-center">
          {/* Native video rendered by Html5Qrcode */}
          <div
            id="instant-qr-reader-target"
            className="w-full h-full [&_video]:w-full [&_video]:h-full [&_video]:object-cover"
          />

          {/* Viewfinder Overlay */}
          {!errorMessage && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              {/* Corner markers */}
              <div className="relative w-48 h-48 sm:w-52 sm:h-52">
                <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-blue-400 rounded-tl-lg" />
                <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-blue-400 rounded-tr-lg" />
                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-blue-400 rounded-bl-lg" />
                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-blue-400 rounded-br-lg" />
                
                {/* Laser scan line animation */}
                <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-blue-400 to-transparent shadow-[0_0_10px_rgba(96,165,250,0.8)] animate-[pulse_2s_ease-in-out_infinite]" />
              </div>
            </div>
          )}

          {/* Initializing Spinner */}
          {isInitializing && !errorMessage && (
            <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center gap-2 z-10">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-[11px] font-bold text-zinc-300">Activando cámara...</span>
            </div>
          )}

          {/* Error View */}
          {errorMessage && (
            <div className="absolute inset-0 bg-black/95 p-4 flex flex-col items-center justify-center gap-3 z-10 text-center">
              <AlertCircle className="w-8 h-8 text-rose-400" />
              <p className="text-xs text-rose-300 font-medium leading-relaxed max-w-[220px]">
                {errorMessage}
              </p>
            </div>
          )}
        </div>

        {/* Status Indicator */}
        <div className="mt-4 flex items-center gap-2 text-[11px] text-zinc-400 font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span>Escaneo automático activo</span>
        </div>

        {/* Cancel Button */}
        <button
          onClick={onClose}
          className="mt-4 w-full py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-xl text-xs font-bold transition-colors border border-zinc-800"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
