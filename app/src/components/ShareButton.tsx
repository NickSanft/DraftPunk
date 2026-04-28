import { useState } from 'react';

export function ShareButton() {
  const [copied, setCopied] = useState(false);

  const handleClick = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable (eg insecure context). Silently no-op.
    }
  };

  return (
    <button
      type="button"
      className={`share-button${copied ? ' copied' : ''}`}
      onClick={handleClick}
      title="Copy room URL"
      aria-live="polite"
    >
      {copied ? '✓ Copied' : 'Share'}
    </button>
  );
}
