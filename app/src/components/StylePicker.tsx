interface Props {
  color: string;
  width: number;
  onColorChange: (color: string) => void;
  onWidthChange: (width: number) => void;
}

const PALETTE = [
  '#18181b', // black
  '#dc2626', // red
  '#ea580c', // orange
  '#ca8a04', // amber
  '#16a34a', // green
  '#0891b2', // cyan
  '#2563eb', // blue
  '#9333ea', // purple
];

export function StylePicker({ color, width, onColorChange, onWidthChange }: Props) {
  return (
    <div className="style-picker">
      <div className="swatches" role="radiogroup" aria-label="Brush color">
        {PALETTE.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={color === c}
            className={`swatch${color === c ? ' active' : ''}`}
            style={{ background: c }}
            onClick={() => onColorChange(c)}
            title={c}
            data-swatch={c}
          />
        ))}
      </div>
      <label className="brush-size">
        <span className="brush-size-label" aria-hidden>
          {width}px
        </span>
        <input
          type="range"
          min={1}
          max={50}
          step={1}
          value={width}
          onChange={(e) => onWidthChange(Number(e.target.value))}
          aria-label={`Brush size: ${width} pixels`}
          data-control="brush-size"
        />
      </label>
    </div>
  );
}
