"use client";

import { useState, type FormEvent } from "react";
import type { GameStarted, RoomView, SelfView } from "@wahala/shared";
import { sendCommand, type LobbyConnection } from "@/lib/lobby-connection";
import { useServerClock } from "@/lib/use-server-clock";

export default function Voting({ room, self, started, socket, connected }: {
  room: RoomView; self: SelfView; started: GameStarted | null; socket: LobbyConnection; connected: boolean;
}) {
  const { remaining } = useServerClock(room.serverNow, room.deadlineAt);
  const [causeId, setCauseId] = useState("");
  const [principalActorParticipantId, setActor] = useState("");
  const [resolutionId, setResolutionId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const name = (id: string) => started?.cast.find(p => p.participantId === id)?.displayName ?? room.participants.find(p => p.participantId === id)?.nickname ?? "Participant";
  async function cast(event: FormEvent) {
    event.preventDefault();
    if (!connected || busy || self.myBallot || remaining === 0) return;
    setBusy(true); setError("");
    try {
      const ack = await sendCommand(socket, "vote:cast", { roomId: room.roomId, requestId: crypto.randomUUID(), causeId, principalActorParticipantId, resolutionId });
      if (!ack.ok) setError(ack.error.message);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Your ballot could not be sealed."); }
    finally { setBusy(false); }
  }
  return <section aria-labelledby="voting-heading" className="space-y-6">
    <div className="rounded-2xl border border-gold/40 bg-surface p-5">
      <div className="flex items-center justify-between gap-4"><p className="eyebrow">Final ballot · Sealed</p><span aria-label="Voting countdown" className={`font-mono text-2xl ${remaining !== null && remaining <= 10 ? "text-coral" : "text-gold"}`}>{remaining ?? 0}s</span></div>
      <h1 id="voting-heading" className="mt-3 text-3xl font-bold">What really happened?</h1><p className="mt-3 text-sm leading-relaxed text-muted">Choose the cause, the principal participant, and how the group should resolve it. Every category needs three of five votes.</p>
    </div>
    {self.myBallot ? <div className="rounded-2xl border border-mint/40 bg-surface p-5">
      <h2 className="text-xl font-bold text-mint">Your ballot is sealed</h2><p className="mt-2 text-sm text-muted">Only you can see your selections until the reveal. Waiting for all five ballots or the server deadline.</p>
      <dl className="mt-5 space-y-4"><div><dt className="eyebrow">Cause</dt><dd className="mt-1">{room.causeOptions.find(o => o.id === self.myBallot!.causeId)?.label}</dd></div><div><dt className="eyebrow">Principal participant</dt><dd className="mt-1">{name(self.myBallot.principalActorParticipantId)}</dd></div><div><dt className="eyebrow">Resolution</dt><dd className="mt-1">{room.resolutionOptions.find(o => o.id === self.myBallot!.resolutionId)?.label}</dd></div></dl>
    </div> : <form onSubmit={cast} className="space-y-6">
      <label className="block font-semibold">1. What caused it?<select aria-label="Ballot cause" className="text-input mt-3" value={causeId} onChange={e => setCauseId(e.target.value)} required disabled={busy || remaining === 0}><option value="">Select a cause</option>{room.causeOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}</select></label>
      <fieldset disabled={busy || remaining === 0}><legend className="font-semibold">2. Who was the principal participant?</legend><div className="mt-3 space-y-2">{room.participants.map(p => <label key={p.participantId} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border p-3 ${principalActorParticipantId === p.participantId ? "border-gold bg-gold/10" : "border-divider bg-surface"}`}><input type="radio" name="principal-participant" value={p.participantId} checked={principalActorParticipantId === p.participantId} onChange={() => setActor(p.participantId)} required className="h-4 w-4 accent-gold" /><span>{name(p.participantId)}{p.participantId === self.participantId ? " (you)" : ""}</span></label>)}</div></fieldset>
      <label className="block font-semibold">3. What should the group do?<select aria-label="Ballot resolution" className="text-input mt-3" value={resolutionId} onChange={e => setResolutionId(e.target.value)} required disabled={busy || remaining === 0}><option value="">Select a resolution</option>{room.resolutionOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}</select></label>
      <p className="text-xs leading-relaxed text-muted">Sealing is final. A missing ballot is an abstention; nobody can vote for you.</p>
      <button className="primary-button w-full" disabled={!connected || busy || remaining === 0 || !causeId || !principalActorParticipantId || !resolutionId}>{busy ? "Sealing…" : remaining === 0 ? "Waiting for the server…" : "Seal my ballot"}</button>
    </form>}
    <details className="rounded-xl border border-divider bg-surface p-4"><summary className="cursor-pointer font-semibold">Review verified public evidence</summary><div className="mt-4 space-y-4">{room.publicClues.map(e => <div key={e.id}><h3 className="text-sm font-semibold text-mint">✓ {e.title}</h3><p className="mt-1 text-sm">{e.body}</p></div>)}</div></details>
    {error && <p role="alert" className="rounded-xl bg-coral/10 p-4 text-sm text-coral">{error}</p>}
  </section>;
}
