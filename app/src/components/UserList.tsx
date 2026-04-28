import type { UserAwareness } from '../crdt/awareness';

interface Props {
  users: readonly UserAwareness[];
  selfUserId: string;
}

export function UserList({ users, selfUserId }: Props) {
  if (users.length === 0) return null;
  return (
    <div className="user-list" role="list" aria-label="Connected users">
      {users.map((u) => (
        <div key={u.userId} className="user-chip" role="listitem">
          <span
            className="user-dot"
            style={{ background: u.color }}
            aria-hidden
          />
          <span className="user-name">
            {u.name}
            {u.userId === selfUserId ? ' (you)' : ''}
          </span>
        </div>
      ))}
    </div>
  );
}
