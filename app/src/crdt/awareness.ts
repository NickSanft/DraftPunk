import type { Awareness } from 'y-protocols/awareness';
import type { ToolType } from '../tools/Tool';

export interface UserAwareness {
  userId: string;
  name: string;
  color: string;
  cursor: { x: number; y: number } | null;
  tool: ToolType;
}

function isUserAwareness(state: unknown): state is UserAwareness {
  return (
    typeof state === 'object' &&
    state !== null &&
    'userId' in state &&
    'name' in state &&
    'color' in state
  );
}

/** All connected peers, including self. Useful for the user list. */
export function getAllAwareness(awareness: Awareness): UserAwareness[] {
  const out: UserAwareness[] = [];
  awareness.getStates().forEach((state) => {
    if (isUserAwareness(state)) out.push(state);
  });
  return out;
}

/** Connected peers excluding self. Useful for cursor rendering. */
export function getRemoteAwareness(awareness: Awareness): UserAwareness[] {
  const out: UserAwareness[] = [];
  awareness.getStates().forEach((state, clientID) => {
    if (clientID === awareness.clientID) return;
    if (isUserAwareness(state)) out.push(state);
  });
  return out;
}
