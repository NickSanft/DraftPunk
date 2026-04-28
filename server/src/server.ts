import type * as Party from "partykit/server";
import { onConnect } from "y-partykit";

export default class DraftPunkServer implements Party.Server {
  constructor(public party: Party.Room) {}

  async onConnect(conn: Party.Connection) {
    return onConnect(conn, this.party, {
      persist: { mode: "snapshot" },
    });
  }

  async onRequest() {
    return new Response("draft-punk sync server ok\n", {
      status: 200,
      headers: { "content-type": "text/plain" },
    });
  }
}
