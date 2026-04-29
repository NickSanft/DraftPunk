export interface AnnouncerMessage {
  msg: string;
  tick: number;
}

export const EMPTY_MESSAGE: AnnouncerMessage = { msg: '', tick: 0 };

interface Props {
  politeMessage: AnnouncerMessage;
  assertiveMessage: AnnouncerMessage;
}

/**
 * Off-screen aria-live regions for screen-reader announcements.
 *
 * The {@link AnnouncerMessage.tick} field is incremented by the caller on
 * every announce() call. We use it as a React `key` so the surrounding
 * element remounts even when the message text is the same — assistive
 * technologies skip duplicate text in a live region without that nudge.
 */
export function Announcer({ politeMessage, assertiveMessage }: Props) {
  return (
    <>
      <div
        key={`polite-${politeMessage.tick}`}
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {politeMessage.msg}
      </div>
      <div
        key={`assertive-${assertiveMessage.tick}`}
        className="sr-only"
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
      >
        {assertiveMessage.msg}
      </div>
    </>
  );
}
