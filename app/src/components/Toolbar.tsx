import type { ToolType } from '../tools/Tool';

interface Props {
  active: ToolType;
  onChange: (tool: ToolType) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const TOOLS: Array<{ type: ToolType; label: string; shortcut: string; icon: string }> = [
  { type: 'pen', label: 'Pen', shortcut: 'B', icon: '✎' },
  { type: 'eraser', label: 'Eraser', shortcut: 'E', icon: '⌫' },
];

export function Toolbar({ active, onChange, onUndo, onRedo, canUndo, canRedo }: Props) {
  return (
    <div className="toolbar" role="toolbar" aria-label="Drawing tools">
      {TOOLS.map((t) => (
        <button
          key={t.type}
          type="button"
          className={`tool ${active === t.type ? 'active' : ''}`}
          onClick={() => onChange(t.type)}
          title={`${t.label} (${t.shortcut})`}
          aria-pressed={active === t.type}
          data-tool={t.type}
        >
          <span className="tool-icon" aria-hidden>{t.icon}</span>
          <span className="tool-label">{t.label}</span>
        </button>
      ))}
      <span className="toolbar-divider" aria-hidden />
      <button
        type="button"
        className="tool"
        onClick={onUndo}
        disabled={!canUndo}
        title="Undo (Ctrl+Z)"
        data-action="undo"
      >
        <span className="tool-icon" aria-hidden>↶</span>
        <span className="tool-label">Undo</span>
      </button>
      <button
        type="button"
        className="tool"
        onClick={onRedo}
        disabled={!canRedo}
        title="Redo (Ctrl+Shift+Z)"
        data-action="redo"
      >
        <span className="tool-icon" aria-hidden>↷</span>
        <span className="tool-label">Redo</span>
      </button>
    </div>
  );
}
