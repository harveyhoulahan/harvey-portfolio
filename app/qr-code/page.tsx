"use client";

import { useEffect, useRef } from "react";

export default function QRCode() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // Dynamically import QRCode library
    import('qrcode').then((QRCode) => {
      if (canvasRef.current) {
        QRCode.default.toCanvas(
          canvasRef.current,
          'https://hjhportfolio.com',
          {
            errorCorrectionLevel: 'H',
            width: 300,
            margin: 2,
            color: {
              dark: '#1a1a2e',
              light: '#ffffff'
            }
          }
        );
      }
    });
  }, []);

  const downloadPNG = () => {
    if (canvasRef.current) {
      const url = canvasRef.current.toDataURL('image/png');
      const a = document.createElement('a');
      a.download = 'harvey-portfolio-qr-code.png';
      a.href = url;
      a.click();
    }
  };

  const downloadSVG = async () => {
    const QRCode = await import('qrcode');
    QRCode.default.toString(
      'https://hjhportfolio.com',
      {
        errorCorrectionLevel: 'H',
        type: 'svg',
        width: 300,
        margin: 2,
        color: {
          dark: '#1a1a2e',
          light: '#ffffff'
        }
      },
      (error: Error | null | undefined, svg: string) => {
        if (error) {
          console.error(error);
          return;
        }
        const blob = new Blob([svg], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.download = 'harvey-portfolio-qr-code.svg';
        a.href = url;
        a.click();
        URL.revokeObjectURL(url);
      }
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 p-8">
      <div className="max-w-lg w-full bg-neutral-900/50 backdrop-blur-xl border border-neutral-800 rounded-2xl p-10 shadow-2xl">
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-red-500 to-purple-600 bg-clip-text text-transparent">
          Harvey Houlahan
        </h1>
        <p className="text-neutral-400 mb-8 text-sm">
          ML Engineer • Portfolio QR Code
        </p>

        <div className="bg-white p-6 rounded-xl inline-block mb-6 shadow-lg">
          <canvas ref={canvasRef} />
        </div>

        <p className="text-red-500 font-semibold mb-6 text-lg">
          hjhportfolio.com
        </p>

        <div className="flex flex-wrap gap-3 mb-6">
          <button
            onClick={downloadPNG}
            className="flex-1 px-6 py-3 bg-gradient-to-r from-red-600 to-purple-600 hover:from-red-700 hover:to-purple-700 text-white font-semibold rounded-lg transition-all duration-300 hover:scale-105 shadow-lg"
          >
            Download PNG
          </button>
          <button
            onClick={downloadSVG}
            className="flex-1 px-6 py-3 bg-gradient-to-r from-red-600 to-purple-600 hover:from-red-700 hover:to-purple-700 text-white font-semibold rounded-lg transition-all duration-300 hover:scale-105 shadow-lg"
          >
            Download SVG
          </button>
          <button
            onClick={() => window.print()}
            className="flex-1 px-6 py-3 bg-neutral-800 hover:bg-neutral-700 text-white font-semibold rounded-lg transition-all duration-300 hover:scale-105 shadow-lg"
          >
            Print
          </button>
        </div>

        <p className="text-neutral-500 text-sm leading-relaxed">
          Scan this QR code to view my portfolio.<br />
          Perfect for business cards, resumes, or presentations.
        </p>
      </div>

      <style jsx global>{`
        @media print {
          body {
            background: white !important;
          }
          .bg-gradient-to-br {
            background: white !important;
          }
          button, .text-neutral-400, .text-neutral-500 {
            display: none !important;
          }
          h1 {
            color: black !important;
            -webkit-text-fill-color: black !important;
          }
          .text-red-500 {
            color: black !important;
          }
        }
      `}</style>
    </div>
  );
}
