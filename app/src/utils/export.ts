import * as Y from 'yjs';

export function encodeProject(doc: Y.Doc): Uint8Array {
  return Y.encodeStateAsUpdate(doc);
}

export function applyProjectUpdate(doc: Y.Doc, bytes: Uint8Array): void {
  Y.applyUpdate(doc, bytes, 'import');
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke after the browser has had a chance to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

export function timestampSuffix(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}
