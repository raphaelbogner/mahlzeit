import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { buildEpcQrPayload } from '../lib/epcQr';
import { fmtPrice } from '../lib/price';

export interface PaymentQrProps {
  beneficiaryName: string;
  iban: string;
  amountCents: number;
  remittance?: string;
  size?: number;
}

export function PaymentQr({
  beneficiaryName,
  iban,
  amountCents,
  remittance,
  size = 192,
}: PaymentQrProps) {
  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState<boolean>(false);

  const payload = useMemo<string | null>(() => {
    if (amountCents <= 0) return null;
    try {
      return buildEpcQrPayload({ beneficiaryName, iban, amountCents, remittance });
    } catch {
      return null;
    }
  }, [beneficiaryName, iban, amountCents, remittance]);

  useEffect(() => {
    if (payload === null) return;
    let cancelled = false;
    // Error correction level "M" is recommended by the EPC spec.
    QRCode.toString(payload, { type: 'svg', errorCorrectionLevel: 'M', margin: 1 })
      .then((out) => {
        if (!cancelled) setSvg(out);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [payload]);

  if (payload === null || failed) {
    return <p className="text-xs text-stone-500">QR konnte nicht erstellt werden</p>;
  }
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
      aria-label={`Zahlungs-QR für ${fmtPrice(amountCents)} an ${beneficiaryName}`}
      // QRCode.toString returns a complete <svg> document — render it inline so
      // it scales to the container.
      dangerouslySetInnerHTML={{
        __html: svg.replace('<svg ', `<svg width="${size}" height="${size}" `),
      }}
    />
  );
}
