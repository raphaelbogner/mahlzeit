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
  // Compact round icon button; `label` becomes the accessible name / tooltip.
  iconOnly?: boolean;
}

function ShareIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3v12" />
      <path d="M8 7l4-4 4 4" />
      <path d="M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7" />
    </svg>
  );
}

// Native share on phones, clipboard copy everywhere else.
export function ShareButton({ label, title, getText, className, disabled, iconOnly }: ShareButtonProps) {
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

  if (iconOnly) {
    return (
      <button
        type="button"
        onClick={() => void handleClick()}
        disabled={disabled || busy}
        className={
          className ??
          'grid h-8 w-8 place-items-center rounded-full text-stone-600 transition hover:bg-stone-100 hover:text-stone-900 disabled:opacity-50'
        }
        aria-label={label}
        title={label}
      >
        <ShareIcon />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={disabled || busy}
      className={(className ?? 'btn-secondary btn-sm') + ' inline-flex items-center gap-1.5'}
      aria-label={label}
    >
      <ShareIcon />
      {label}
    </button>
  );
}
