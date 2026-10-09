"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { AVATARS, CASE_ID, CASE_TITLE, createRoomSchema, joinRoomSchema, SEAT_COUNT } from "@wahala/shared";
import type { BotPolicy, RoomView, Snapshot, RoleAssignment, GameStarted } from "@wahala/shared";
import { openLobbyConnection, sendCommand, type LobbyConnection } from "@/lib/lobby-connection";
import SecretRole from "./secret-role";

const STORAGE_KEY = "wahala:lobby";
const avatarColors: Record<string, string> = {
  gold: "#F3C261", mint: "#72B6A0", coral: "#E36B66", lavender: "#B0A0D7", sky: "#8AB7D7",
};

export default function Lobby() {
  const socketRef = useRef<LobbyConnection | null>(null);
  const roomRef = useRef<RoomView | null>(null);
  const [room, setRoom] = useState<RoomView | null>(null);
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [connection, setConnection] = useState("Connecting…");
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [nickname, setNickname] = useState("");
  const [avatarId, setAvatarId] = useState<(typeof AVATARS)[number]>("gold");
  const [code, setCode] = useState("");
  const [tab, setTab] = useState<"create" | "join">("create");
  const [botPolicy, setBotPolicy] = useState<BotPolicy>("none");
  const [consent, setConsent] = useState(false);
  const [connectionAttempt, setConnectionAttempt] = useState(0);
  const [role, setRole] = useState<RoleAssignment | null>(null);
  const [started, setStarted] = useState<GameStarted | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);

  useEffect(() => {
    let disposed = false;
    let socket: LobbyConnection | null = null;

    const clearRoom = () => {
      roomRef.current = null;
      setRoom(null); setParticipantId(null); setConsent(false);
      setRole(null); setStarted(null); setAcknowledged(false);
      localStorage.removeItem(STORAGE_KEY);
    };
    const update = (view: RoomView) => {
      const current = roomRef.current;
      if (current && current.roomId === view.roomId && current.version > view.version) return;
      roomRef.current = view;
      setRoom(view);
      localStorage.setItem(STORAGE_KEY, view.roomId);
    };
    async function connect() {
      try {
        socket = await openLobbyConnection();
        if (disposed) { socket.disconnect(); return; }
        const invite = new URLSearchParams(window.location.search).get("code");
        if (invite) { setCode(invite.toUpperCase()); setTab("join"); }
        socketRef.current = socket;
        socket.on("state:snapshot", (snapshot: Snapshot) => {
          update(snapshot.public);
          setParticipantId(snapshot.self.participantId);
          setError("");
        });
        socket.on("room:updated", ({ view }) => update(view));
        socket.on("game:started", (value) => setStarted(value));
        socket.on("role:assign", (card) => setRole(card));
        socket.on("room:closed", () => {
          clearRoom(); setNotice("Your lobby expired. You can create or join another one.");
        });
        socket.on("connect", () => {
          setConnection("Connected"); setConnected(true); setConnecting(false);
          const roomId = localStorage.getItem(STORAGE_KEY);
          if (roomId) {
            void sendCommand(socket!, "state:resume", { requestId: crypto.randomUUID(), roomId })
              .then((ack) => {
                if (disposed) return;
                if (!ack.ok) {
                  clearRoom();
                  setNotice("Your previous seat is no longer available. Create or join a lobby.");
                }
              }).catch((reason: Error) => { if (!disposed) setError(reason.message); });
          }
        });
        socket.on("disconnect", () => {
          setConnected(false); setConnection("Reconnecting to your seat…"); setConsent(false);
          // Never display a private dossier while its connection is stale.
          setRole(null);
        });
        socket.on("connect_error", () => {
          setConnected(false); setConnecting(false);
          setConnection("Connection unavailable");
          setError("Could not connect to Wahala. Check your connection and try reconnecting.");
        });
        socket.connect();
      } catch (reason) {
        if (!disposed) {
          setConnecting(false); setConnection("Connection unavailable");
          setError(reason instanceof Error ? reason.message : "Could not connect.");
        }
      }
    }
    void connect();
    return () => { disposed = true; socket?.removeAllListeners(); socket?.disconnect(); socketRef.current = null; };
  }, [connectionAttempt]);

  async function enter(event: FormEvent) {
    event.preventDefault();
    const socket = socketRef.current;
    if (!socket?.connected || busy) return;
    setError(""); setNotice(""); setBusy(true);
    try {
      const requestId = crypto.randomUUID();
      const ack = tab === "create"
        ? await sendCommand(socket, "room:create", createRoomSchema.parse({ requestId, caseId: CASE_ID,
          nickname, avatarId, mode: "PRIVATE", botPolicy }))
        : await sendCommand(socket, "room:join", joinRoomSchema.parse({ requestId, code, nickname, avatarId }));
      if (!ack.ok) setError(ack.error.message);
    } catch (reason) {
      if (reason && typeof reason === "object" && "issues" in reason) setError("Enter a nickname (1–24 characters) and a valid six-character room code when joining.");
      else setError(reason instanceof Error ? reason.message : "Could not enter the lobby.");
    } finally { setBusy(false); }
  }

  const me = room?.participants.find((p) => p.participantId === participantId);
  const everyoneReady = room?.participants.length === 5 && room.participants.every((p) => p.ready && p.connected);
  async function startGame() {
    if (!room || !me?.isHost || !socketRef.current?.connected || busy) return;
    setBusy(true); setError("");
    try {
      const ack = await sendCommand(socketRef.current, "room:start", { requestId: crypto.randomUUID(), roomId: room.roomId });
      if (!ack.ok) setError(ack.error.message);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The case could not start."); }
    finally { setBusy(false); }
  }
  async function acknowledgeRole() {
    if (!room || !role || !socketRef.current?.connected || busy) return;
    setBusy(true); setError("");
    try {
      const ack = await sendCommand(socketRef.current, "role:acknowledge", { requestId: crypto.randomUUID(), roomId: room.roomId });
      if (!ack.ok) setError(ack.error.message);
      else setAcknowledged(true);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Your role could not be confirmed."); }
    finally { setBusy(false); }
  }
  async function toggleReady() {
    if (!room || !me || !socketRef.current?.connected || busy) return;
    setBusy(true); setError("");
    try {
      const ack = await sendCommand(socketRef.current, "room:ready", {
        requestId: crypto.randomUUID(), roomId: room.roomId, ready: !me.ready,
        ...(room.botPolicy === "allow_bots" ? { acceptBotFill: consent, acceptedIdentityHiddenDisclosure: consent } : {}),
      });
      if (!ack.ok) setError(ack.error.message);
      else if (!ack.data.ready) setConsent(false);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Readiness could not be updated."); }
    finally { setBusy(false); }
  }

  async function copyInvite() {
    if (!room?.code) return;
    const url = new URL(window.location.origin);
    url.searchParams.set("code", room.code);
    try { await navigator.clipboard.writeText(url.toString()); setNotice("Invite link copied."); }
    catch { setNotice(`Invite code: ${room.code}`); }
  }

  return (
    <main className={`mx-auto flex min-h-screen w-full max-w-lg flex-col px-5 py-8 sm:px-8 ${room?.phase === "ROLES" ? "bg-[#090C11]" : ""}`}>
      <header className="mb-10 flex items-center justify-between gap-3">
        <Link href="/" className="text-2xl font-black tracking-[0.15em] text-gold" aria-label="Wahala home">WAHALA<span className="text-coral">.</span></Link>
        <span className="text-xs text-muted" role="status"><span className={`mr-2 inline-block h-2 w-2 rounded-full ${connected ? "bg-mint" : "bg-coral"}`} />{connection}</span>
      </header>

      {room?.phase === "ROLES" ? (
        role && role.roomId === room.roomId ? <SecretRole key={`${role.roomId}:${role.personaId}`} card={role}
          displayName={started?.cast.find((p) => p.personaId === role.personaId)?.displayName ?? role.personaId}
          connected={connected} busy={busy} acknowledged={acknowledged} onProceed={acknowledgeRole} />
          : <p role="status" className="rounded-2xl border border-divider bg-surface p-6 text-center">{connected ? "Opening your private dossier…" : "Reconnecting to your secret role…"}</p>
      ) : room ? (
        <section aria-labelledby="lobby-heading" className="space-y-6">
          <div><p className="eyebrow">Private lobby</p><h1 id="lobby-heading" className="mt-2 text-3xl font-bold leading-tight">{room.title}</h1>
            <p className="mt-3 text-muted">Five characters. Five secrets.</p></div>
          <div className="flex items-center justify-between rounded-2xl border border-divider bg-surface p-4">
            <div><p className="text-xs text-muted">ROOM CODE</p><p data-testid="room-code" className="mt-1 font-mono text-2xl tracking-[0.2em] text-gold">{room.code}</p></div>
            <button type="button" className="secondary-button" onClick={copyInvite}>Copy invite</button>
          </div>
          <ol aria-label="Lobby seats" className="space-y-3">
            {Array.from({ length: SEAT_COUNT }, (_, index) => {
              const player = room.participants[index];
              return <li key={player?.participantId ?? `empty-${index}`} className="flex min-h-20 items-center gap-3 rounded-2xl border border-divider bg-surface px-4 py-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-divider text-lg font-bold" style={player ? { backgroundColor: avatarColors[player.avatarId], color: "#11151B" } : undefined} aria-hidden="true">{player ? player.nickname.slice(0, 1).toUpperCase() : "+"}</span>
                <div className="min-w-0 flex-1"><p className="truncate font-semibold">{player ? `${player.nickname}${player.participantId === participantId ? " (you)" : ""}` : "Open seat"}</p>
                  <p className="mt-1 text-xs text-muted">{player ? `${player.isHost ? "Host · " : ""}${player.connected ? "In lobby" : "Reconnecting · seat reserved"}` : "Invite a friend"}</p></div>
                {player && <span data-testid="ready-state" className={`shrink-0 text-sm ${player.ready ? "text-mint" : "text-muted"}`}>{player.ready ? "Ready ✓" : "Not ready"}</span>}
              </li>;
            })}
          </ol>
          <div className="rounded-2xl border border-divider bg-surface p-4 text-sm">
            {room.botPolicy === "none" ? <p>Humans-only lobby. Invite friends to fill the five seats.</p> : <>
              <p>AI-controlled characters may fill empty seats. Their identities stay hidden during play and can be revealed after the round. You can choose a humans-only lobby instead.</p>
              {!me?.ready && <label className="mt-4 flex cursor-pointer items-start gap-3"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-gold" /><span>I accept possible AI participation and hidden character identities.</span></label>}
              <p className="mt-3 text-muted">Bot fill will be added in a later step.</p>
            </>}
          </div>
          <button type="button" className={me?.ready ? "secondary-button w-full" : "primary-button w-full"} onClick={toggleReady}
            disabled={!connected || !me || busy || (!me.ready && room.botPolicy === "allow_bots" && !consent)}>
            {busy ? "Updating…" : me?.ready ? "Not ready" : "Ready"}
          </button>
          {me?.isHost && <button type="button" className="primary-button w-full" onClick={startGame} disabled={!connected || busy || !everyoneReady}>Start case</button>}
          <p className="text-center text-sm text-muted" role="status">{everyoneReady
            ? "Everyone is ready. The host can start the case."
            : "Waiting for five players to be ready."}</p>
        </section>
      ) : (
        <section aria-labelledby="welcome-heading" className="space-y-7">
          <div><p className="eyebrow">Everybody knows something.</p><h1 id="welcome-heading" className="mt-3 text-4xl font-bold leading-tight">Nobody knows<br />everything.</h1><p className="mt-4 text-muted">Bring your people. Get your seat.</p></div>
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-surface p-1" aria-label="Lobby action">
            <button type="button" aria-pressed={tab === "create"} className={`tab-button ${tab === "create" ? "bg-raised text-white" : "text-muted"}`} onClick={() => setTab("create")}>Create room</button>
            <button type="button" aria-pressed={tab === "join"} className={`tab-button ${tab === "join" ? "bg-raised text-white" : "text-muted"}`} onClick={() => setTab("join")}>Join room</button>
          </div>
          <form onSubmit={enter} className="space-y-5">
            <label className="block text-sm font-medium">Your nickname<input name="nickname" className="text-input mt-2" value={nickname} onChange={(event) => setNickname(event.target.value)} maxLength={24} required autoComplete="nickname" placeholder="What should we call you?" /></label>
            <fieldset><legend className="mb-3 text-sm font-medium">Choose your avatar</legend><div className="flex gap-3">{AVATARS.map((avatar) => <label key={avatar} className="relative flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border-2" style={{ backgroundColor: avatarColors[avatar], borderColor: avatarId === avatar ? "white" : "transparent" }}>
              <input type="radio" name="avatar" value={avatar} checked={avatarId === avatar} onChange={() => setAvatarId(avatar)} className="sr-only" aria-label={`${avatar} avatar`} /><span className="text-lg font-bold text-background" aria-hidden="true">{avatarId === avatar ? "✓" : ""}</span></label>)}</div></fieldset>
            {tab === "join" ? <label className="block text-sm font-medium">Room code<input name="code" className="text-input mt-2 font-mono uppercase tracking-widest" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} maxLength={6} minLength={6} required autoComplete="off" placeholder="ABC234" /></label> : <>
              <div className="rounded-2xl border border-divider bg-surface p-4"><p className="text-xs text-gold">FIRST CASE</p><p className="mt-2 font-semibold">{CASE_TITLE}</p></div>
              <label className="block text-sm font-medium">Room preference<select className="text-input mt-2" value={botPolicy} onChange={(event) => setBotPolicy(event.target.value as BotPolicy)}><option value="none">Humans only</option><option value="allow_bots">Allow AI (consent required)</option></select></label>
              {botPolicy === "allow_bots" && <p className="text-sm text-muted">Each player must accept possible AI participation and hidden identities before becoming ready. Bot fill is coming later.</p>}
            </>}
            <button type="submit" className="primary-button w-full" disabled={!connected || connecting || busy}>{busy ? "Entering…" : tab === "create" ? "Create private room" : "Join private room"}</button>
          </form>
        </section>
      )}
      {error && <p role="alert" className="mt-5 rounded-xl border border-coral/50 bg-coral/10 p-4 text-sm text-coral">{error}</p>}
      {notice && <p role="status" className="mt-4 text-sm text-gold">{notice}</p>}
      {!connected && !connecting && <button type="button" className="secondary-button mt-4" onClick={() => { setConnecting(true); setError(""); setConnection("Connecting…"); setConnectionAttempt((value) => value + 1); }}>Reconnect</button>}
      <footer className="mt-auto pt-10 text-center text-xs text-muted">You know what you did. You don&apos;t know what it caused.</footer>
    </main>
  );
}
