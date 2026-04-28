import type { UserAwareness } from '../crdt/awareness';

const LABEL_FONT = '500 11px ui-sans-serif, system-ui, -apple-system, sans-serif';
const DOT_RADIUS = 5;
const LABEL_PAD_X = 6;
const LABEL_HEIGHT = 18;

export function renderCursor(ctx: CanvasRenderingContext2D, user: UserAwareness): void {
  if (!user.cursor) return;
  const { x, y } = user.cursor;

  ctx.save();

  ctx.fillStyle = user.color;
  ctx.beginPath();
  ctx.arc(x, y, DOT_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.font = LABEL_FONT;
  const text = user.name;
  const textWidth = ctx.measureText(text).width;
  const labelX = x + 9;
  const labelY = y + 6;
  const labelWidth = textWidth + LABEL_PAD_X * 2;

  ctx.fillStyle = user.color;
  ctx.fillRect(labelX, labelY, labelWidth, LABEL_HEIGHT);

  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, labelX + LABEL_PAD_X, labelY + LABEL_HEIGHT / 2);

  ctx.restore();
}

export function renderCursors(
  ctx: CanvasRenderingContext2D,
  users: readonly UserAwareness[],
): void {
  for (const u of users) renderCursor(ctx, u);
}
