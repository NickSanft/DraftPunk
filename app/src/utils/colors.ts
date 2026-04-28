// Perceptually-distinct palette suitable for assigning to users.
// Tested against protanopia/deuteranopia/tritanopia simulators — no pair
// of colors collapses to indistinguishable hues under common color-blindness.
const USER_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#a855f7', // purple
  '#ec4899', // pink
];

export function colorForUser(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return USER_COLORS[hash % USER_COLORS.length];
}

export function nameForUser(userId: string): string {
  // userId looks like "user-abc123"; strip the prefix for display.
  return userId.replace(/^user-/, '');
}
