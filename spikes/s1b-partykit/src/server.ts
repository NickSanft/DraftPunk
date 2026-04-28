import type * as Party from "partykit/server";
import { onConnect } from "y-partykit";

export default class YjsServer implements Party.Server {
  constructor(public party: Party.Room) {}

  async onConnect(conn: Party.Connection) {
    console.log(`[${this.party.id}] connect ${conn.id} (peers now: ${[...this.party.getConnections()].length})`);
    return onConnect(conn, this.party, {
      persist: { mode: "snapshot" },
    });
  }

  async onClose(conn: Party.Connection) {
    console.log(`[${this.party.id}] close   ${conn.id} (peers now: ${[...this.party.getConnections()].length})`);
  }
}
