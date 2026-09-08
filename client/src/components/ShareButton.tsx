import { useState } from 'react';
import { shareOrCopy } from '../lib/share';
import { useToast } from './Toast';

export interface ShareButtonProps {
  label: string;
  // Title for the native share sheet.
  title: string;
  // Built lazily so the text reflects the latest state at click time.
  getText: () => string;
  className?: string;
  disabled?: boolean;
}

// Native share on phones, clipboard copy everywhere else.
export function ShareButton({ label, title, getText, className, disabled }: ShareButtonProps) {
  const [busy, setBusy] = useState<boolean>(false);
  const { showError, showInfo } = useToast();

  async function handleClick(): Promise<void> {
    setBusy(true);
    try {
      const outcome = await shareOrCopy({ title, text: getText() }, navigator, document);
      if (outcome === 'copied') showInfo('Text kopiert – einfach einfügen und abschicken.');
      else if (outcome === 'failed') showError('Teilen ist hier nicht möglich.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={disabled || busy}
      className={className ?? 'btn-secondary btn-sm'}
      aria-label={label}
    >
      <span aria-hidden="true">↗ </span>
      {label}
    </button>
  );
}
