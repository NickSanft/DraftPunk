import { useRef } from 'react';

interface Props {
  onExportPng: () => void;
  onSaveProject: () => void;
  onLoadProject: (bytes: Uint8Array) => void;
}

export function ExportMenu({ onExportPng, onSaveProject, onLoadProject }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLoadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const buffer = await file.arrayBuffer();
    onLoadProject(new Uint8Array(buffer));
    // Reset so the same file can be picked again later.
    e.target.value = '';
  };

  return (
    <div className="export-menu">
      <button
        type="button"
        className="tool"
        onClick={onExportPng}
        title="Export the canvas as a PNG image"
        data-action="export-png"
      >
        Export PNG
      </button>
      <button
        type="button"
        className="tool"
        onClick={onSaveProject}
        title="Save the full project state as a .draftpunk file"
        data-action="save-project"
      >
        Save
      </button>
      <button
        type="button"
        className="tool"
        onClick={handleLoadClick}
        title="Load a .draftpunk project file"
        data-action="load-project"
      >
        Load
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".draftpunk,application/octet-stream"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
    </div>
  );
}
