import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export interface QrCodeProps {
  value: string;
  size?: number;
  label: string;
}

// Generic inline SVG QR code (the payment QR has its own EPC-specific wrapper).
export function QrCode({ value, size = 176, label }: QrCodeProps) {
  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    QRCode.toString(value, { type: 'svg', errorCorrectionLevel: 'M', margin: 1 })
      .then((out) => {
        if (!cancelled) {
          setSvg(out);
          setFailed(false);
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [value]);

  if (failed) return <p className="text-xs text-stone-500">QR konnte nicht erstellt werden</p>;
  if (!svg) {
    return (
      <div
        className="animate-pulse rounded-lg bg-stone-200"
        style={{ width: size, height: size }}
        aria-label="QR-Code wird geladen"
      />
    );
  }
  return (
    <div
      className="inline-block rounded-lg bg-white p-2 ring-1 ring-stone-200"
      style={{ width: size + 16, height: size + 16 }}
      role="img"
      aria-label={label}
      dangerouslySetInnerHTML={{
        __html: svg.replace('<svg ', `<svg width="${size}" height="${size}" `),
      }}
    />
  );
}
