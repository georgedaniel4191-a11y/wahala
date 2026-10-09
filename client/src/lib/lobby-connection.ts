import { io, type Socket } from "socket.io-client";
import type { Ack, ClientToServerEvents, ServerToClientEvents } from "@wahala/shared";

export type LobbyConnection = Socket<ServerToClientEvents, ClientToServerEvents>;
export async function openLobbyConnection() {
  const response = await fetch("/api/session/guest", {
    method: "POST", credentials: "same-origin",
  });
  if (!response.ok) throw new Error(response.status === 429
    ? "Too many connection attempts. Please wait a minute."
    : "Could not connect to Wahala. Please try again.");
  const socket: LobbyConnection = io({
    autoConnect: false, withCredentials: true,
    transports: ["polling", "websocket"],
  });
  return socket;
}

export type LobbyEvent = keyof ClientToServerEvents;
type Payload<E extends LobbyEvent> = Parameters<ClientToServerEvents[E]>[0];
type Response<E extends LobbyEvent> = Parameters<Parameters<ClientToServerEvents[E]>[1]>[0];

export async function sendCommand<E extends LobbyEvent>(
  socket: LobbyConnection, event: E, payload: Payload<E>,
): Promise<Response<E>> {
  // Both attempts send exactly the same UUID; an ACK loss cannot create a
  // second seat or toggle readiness twice. The server caches the first result.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      // This local adapter erases Socket.IO's overloaded generics only; callers
      // remain checked against the shared event/payload contract above.
      const emit = socket.timeout(5_000).emit.bind(socket) as unknown as (
        name: E, command: Payload<E>, callback: (error: Error | null, response: Ack<unknown>) => void,
      ) => void;
      return await new Promise<Response<E>>((resolve, reject) => {
        emit(event, payload, (error, response) => {
          if (error) reject(error); else resolve(response as Response<E>);
        });
      });
    } catch {
      if (attempt === 1) throw new Error("No response yet. Reconnect to check your seat before trying again.");
    }
  }
  throw new Error("The connection was interrupted.");
}
