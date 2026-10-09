"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { ActionSelection, ChatMessage, GameStarted, RoomView, SelfView, ServerToClientEvents, VerifiedClue } from "@wahala/shared";
import { sendCommand, type LobbyConnection } from "@/lib/lobby-connection";

type Challenge = Parameters<ServerToClientEvents["action:respond_requested"]>[0];
type Deal = Parameters<ServerToClientEvents["deal:offered"]>[0];
const labels: Record<string, string> = { INVESTIGATION_1: "Opening investigation", SETTLING_1: "Resolving actions", TWIST: "The twist", INVESTIGATION_2: "Evidence round two", SETTLING_2: "Resolving actions", INVESTIGATION_3: "Final investigation", SETTLING_3: "Final settlement", ABANDONED: "Case abandoned" };
const moves = ["INVESTIGATE", "CONFRONT", "EXPOSE", "MAKE_DEAL", "DEFEND", "TRACE_SELF", "ABILITY", "PASS"] as const;

export default function Investigation({ room, self, started, socket, connected }: { room: RoomView; self: SelfView; started: GameStarted | null; socket: LobbyConnection; connected: boolean }) {
  const [clock, setClock] = useState({ server: Date.parse(room.serverNow), received: 0, elapsed: 0 });
  const [text, setText] = useState("");
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [kind, setKind] = useState<ActionSelection["kind"]>("INVESTIGATE");
  const [leads, setLeads] = useState<{ id: string; label: string }[]>([]);
  const [lead, setLead] = useState("");
  const [target, setTarget] = useState("");
  const [evidence, setEvidence] = useState("");
  const [requested, setRequested] = useState("");
  const [accusation, setAccusation] = useState("");
  const [statement, setStatement] = useState("");
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [reply, setReply] = useState("");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let disposed = false;
    fetch("/api/cases").then(r => r.json()).then(data => {
      const available = data.cases.find((c: { caseId: string }) => c.caseId === room.caseId)?.investigationLeads ?? [];
      if (!disposed) { setLeads(available); setLead(available[0]?.id ?? ""); }
    }).catch(() => { if (!disposed) setError("Investigation leads could not load. Reconnect to try again."); });
    return () => { disposed = true; };
  }, [room.caseId]);
  useEffect(() => {
    // Server time plus monotonic elapsed time: presentation only, never advance.
    const server = Date.parse(room.serverNow); const received = performance.now();
    const timer = setInterval(() => setClock({ server, received, elapsed: performance.now() - received }), 250);
    return () => clearInterval(timer);
  }, [room.serverNow]);
  useEffect(() => {
    const snapshot: ServerToClientEvents["state:snapshot"] = value => { if (value.roomId === room.roomId) { setChat(value.recentChat); setChallenges([]); setDeals([]); } };
    const message: ServerToClientEvents["chat:message"] = value => { if (value.roomId === room.roomId) setChat(current => current.some(m => m.id === value.message.id) ? current : [...current, value.message].slice(-100)); };
    const challenge: ServerToClientEvents["action:respond_requested"] = value => { if (value.roomId === room.roomId) setChallenges(current => current.some(c => c.challengeId === value.challengeId) ? current : [...current, value]); };
    const deal: ServerToClientEvents["deal:offered"] = value => { if (value.roomId === room.roomId) setDeals(current => current.some(d => d.offerId === value.offerId) ? current : [...current, value]); };
    const resolved: ServerToClientEvents["action:resolved"] = value => { if (value.roomId === room.roomId) setResult(value.text); };
    socket.on("state:snapshot", snapshot); socket.on("chat:message", message); socket.on("action:respond_requested", challenge); socket.on("deal:offered", deal); socket.on("action:resolved", resolved);
    // Hydrate chat and outstanding owner-only requests after mounting/reloading.
    void sendCommand(socket, "state:resume", { roomId: room.roomId, requestId: crypto.randomUUID() }).catch(() => undefined);
    return () => { socket.off("state:snapshot", snapshot); socket.off("chat:message", message); socket.off("action:respond_requested", challenge); socket.off("deal:offered", deal); socket.off("action:resolved", resolved); };
  }, [socket, room.roomId]);

  const now = clock.server + clock.elapsed;
  const remaining = room.deadlineAt ? Math.max(0, Math.ceil((Date.parse(room.deadlineAt) - now) / 1000)) : null;
  const investigating = room.phase.startsWith("INVESTIGATION_");
  const settling = room.phase.startsWith("SETTLING_") && room.deadlineAt !== null;
  const availableEvidence = [...self.myEvidence, ...self.myMemoryFragments];
  const name = (id: string) => started?.cast.find(p => p.participantId === id)?.displayName ?? room.participants.find(p => p.participantId === id)?.nickname ?? "Participant";
  const displayReceipt = (clue: VerifiedClue) => <details key={clue.id} className="rounded-xl border border-divider bg-raised p-4"><summary className="cursor-pointer font-semibold text-mint">✓ {clue.title}</summary><p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{clue.body}</p><p className="mt-2 font-mono text-xs text-muted">Receipt ID: {clue.id}</p></details>;
  async function perform(work: () => Promise<void>) {
    if (busy || !connected) return;
    setBusy(true); setError("");
    try { await work(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not submit."); } finally { setBusy(false); }
  }
  async function select(event: FormEvent) {
    event.preventDefault();
    let action: ActionSelection;
    switch (kind) {
      case "INVESTIGATE": action = { kind, leadId: lead }; break;
      case "CONFRONT": action = { kind, targetParticipantId: target, question: statement }; break;
      case "EXPOSE": action = { kind, evidenceId: evidence }; break;
      case "MAKE_DEAL": action = { kind, targetParticipantId: target, offerEvidenceId: evidence, requestEvidenceId: requested }; break;
      case "DEFEND": action = { kind, targetParticipantId: room.accusationMarkers.find(a => a.id === accusation)?.targetParticipantId ?? "", accusationId: accusation, explanation: statement }; break;
      case "ABILITY": action = { kind, abilityId: self.ability?.id ?? "", ...(self.ability?.id === "a_tobi" ? { targetParticipantId: target } : {}) }; break;
      default: action = { kind };
    }
    await perform(async () => {
      const ack = await sendCommand(socket, "action:submit", { roomId: room.roomId, requestId: crypto.randomUUID(), round: room.round as 1 | 2 | 3, action });
      if (!ack.ok) throw new Error(ack.error.message);
      setResult("Choice saved. You can revise it before the server cutoff.");
    });
  }
  const feed = [...room.publicEvents.map(e => ({ id: e.id, text: e.text, createdAt: e.createdAt, author: e.fromParticipantId ? name(e.fromParticipantId) : "Case update", verified: true })), ...chat.map(m => ({ id: m.id, text: m.text, createdAt: m.createdAt, author: name(m.fromParticipantId), verified: false }))].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return <section className="space-y-6" aria-labelledby="investigation-heading">
    <div className="rounded-2xl border border-gold/40 bg-surface p-5">
      <div className="flex items-center justify-between gap-4"><p className="eyebrow">Round {room.round} / 3</p><span className="font-mono text-xl text-gold" aria-label="Server countdown">{remaining === null ? "Paused" : `${remaining}s`}</span></div>
      <h1 id="investigation-heading" className="mt-3 text-3xl font-bold">{labels[room.phase] ?? room.phase}</h1>
      <p className="mt-2 text-sm text-muted">{investigating ? "One move. Change your selection until the server cutoff." : settling ? "Actions are locked. Answer pending requests below." : room.phase === "TWIST" ? "A verified world event may change the conversation." : room.phase === "ABANDONED" ? "Too few players remained connected. This case has ended." : "Investigation complete. Voting is coming in the next sprint."}</p>
    </div>
    <section aria-label="Evidence board" className="space-y-3"><h2 className="text-xl font-bold">Evidence board</h2><p className="text-xs text-muted">Public, verified receipts. Statements in the conversation can be mistaken.</p>{room.publicClues.map(displayReceipt)}</section>
    <section aria-label="Conversation" className="rounded-2xl border border-divider bg-surface p-4">
      <h2 className="text-xl font-bold">Conversation</h2><ol className="mt-4 max-h-80 space-y-4 overflow-y-auto" aria-live="polite">{feed.map(item => <li key={item.id}><p className={`text-xs font-semibold ${item.verified ? "text-gold" : "text-muted"}`}>{item.author} · {item.verified ? "Action / case update" : "Player statement"}</p><p className="mt-1 whitespace-pre-wrap break-words text-sm">{item.text}</p></li>)}</ol>
      <form onSubmit={event => { event.preventDefault(); void perform(async () => { const ack = await sendCommand(socket, "chat:send", { roomId: room.roomId, requestId: crypto.randomUUID(), channel: "GAME", text }); if (!ack.ok) throw new Error(ack.error.message); setText(""); }); }} className="mt-4 space-y-2"><label className="text-sm">Your statement<textarea className="text-input mt-2" value={text} onChange={e => setText(e.target.value)} maxLength={500} required /></label><button className="secondary-button w-full" disabled={!connected || busy}>Send statement</button></form>
    </section>
    {settling && <section aria-label="Pending responses" className="space-y-3">
      {challenges.filter(c => Date.parse(c.deadlineAt) > now).map(c => <div key={c.challengeId} className="rounded-xl border border-coral/40 bg-surface p-4"><p className="font-semibold">{name(c.fromParticipantId)} asks</p><p className="mt-2 text-sm">{c.question}</p><textarea aria-label="Challenge answer" className="text-input mt-3" maxLength={500} value={reply} onChange={e => setReply(e.target.value)} /><div className="mt-3 flex gap-3">{(["ANSWER", "REFUSE"] as const).map(response => <button key={response} className="secondary-button" disabled={busy || !connected || (response === "ANSWER" && !reply.trim())} onClick={() => void perform(async () => { const ack = await sendCommand(socket, "action:respond", { roomId: room.roomId, requestId: crypto.randomUUID(), challengeId: c.challengeId, response, ...(response === "ANSWER" ? { text: reply } : {}) }); if (!ack.ok) throw new Error(ack.error.message); setChallenges(current => current.filter(v => v.challengeId !== c.challengeId)); setReply(""); })}>{response === "ANSWER" ? "Answer" : "Refuse"}</button>)}</div></div>)}
      {deals.filter(d => Date.parse(d.deadlineAt) > now).map(d => <div key={d.offerId} className="rounded-xl border border-mint/40 bg-surface p-4"><p>{name(d.fromParticipantId)} offers a verified copy of <strong>{d.offeredEvidenceId}</strong> for <strong>{availableEvidence.find(e => e.id === d.requestedEvidenceId)?.title ?? d.requestedEvidenceId}</strong>.</p><div className="mt-3 flex gap-3">{[true, false].map(accept => <button key={String(accept)} className="secondary-button" disabled={busy || !connected} onClick={() => void perform(async () => { const ack = await sendCommand(socket, "deal:respond", { roomId: room.roomId, requestId: crypto.randomUUID(), offerId: d.offerId, accept }); if (!ack.ok) throw new Error(ack.error.message); setDeals(current => current.filter(v => v.offerId !== d.offerId)); })}>{accept ? "Accept exchange" : "Decline"}</button>)}</div></div>)}
    </section>}
    <details className="rounded-2xl border border-divider bg-surface p-4"><summary className="cursor-pointer font-bold">Confidential · {name(self.participantId)}</summary><div className="mt-4 space-y-4"><p className="text-sm">{self.startingMemory}</p>{self.midgameMemory && <div><p className="eyebrow">New memory</p><p className="mt-2 text-sm">{self.midgameMemory}</p></div>}<p className="text-sm text-gold">Mission: {self.mission?.description}</p><p className="text-sm">{self.ability?.description} <span className="text-muted">({self.ability?.used ? "Used" : "Available once"})</span></p><h3 className="font-semibold">Your private receipts</h3>{availableEvidence.length ? availableEvidence.map(displayReceipt) : <p className="text-sm text-muted">No private receipts yet.</p>}</div></details>
    {investigating && <details open className="rounded-2xl border border-gold/40 bg-surface p-4"><summary className="cursor-pointer text-xl font-bold">Choose your move</summary><form className="mt-4 space-y-4" onSubmit={select}>
      <label className="block text-sm">Action<select className="text-input mt-2" value={kind} onChange={e => setKind(e.target.value as ActionSelection["kind"])}>{moves.map(move => <option key={move} value={move} disabled={move === "ABILITY" && (self.ability?.used || (self.ability?.id === "a_feyi" && room.round !== 1))}>{move.replaceAll("_", " ")}</option>)}</select></label>
      {kind === "INVESTIGATE" && <label className="block text-sm">Lead<select className="text-input mt-2" value={lead} onChange={e => setLead(e.target.value)} required>{leads.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}</select></label>}
      {(["CONFRONT", "MAKE_DEAL"].includes(kind) || (kind === "ABILITY" && self.ability?.id === "a_tobi")) && <label className="block text-sm">Participant<select className="text-input mt-2" value={target} onChange={e => setTarget(e.target.value)} required><option value="">Choose participant</option>{room.participants.filter(p => p.participantId !== self.participantId).map(p => <option key={p.participantId} value={p.participantId}>{name(p.participantId)}</option>)}</select></label>}
      {["EXPOSE", "MAKE_DEAL"].includes(kind) && <label className="block text-sm">Your receipt<select className="text-input mt-2" value={evidence} onChange={e => setEvidence(e.target.value)} required><option value="">Choose owned receipt</option>{availableEvidence.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}</select></label>}
      {kind === "MAKE_DEAL" && <label className="block text-sm">Requested receipt ID<input className="text-input mt-2" value={requested} onChange={e => setRequested(e.target.value)} maxLength={64} required placeholder="Ask them for its ID" /><p className="mt-2 text-xs text-muted">Private holdings stay private. Ask the other player which receipt they can offer.</p></label>}
      {kind === "DEFEND" && <label className="block text-sm">Accusation<select className="text-input mt-2" value={accusation} onChange={e => setAccusation(e.target.value)} required><option value="">Choose accusation</option>{room.accusationMarkers.map(a => <option key={a.id} value={a.id}>{name(a.targetParticipantId)} · {a.status}</option>)}</select></label>}
      {["CONFRONT", "DEFEND"].includes(kind) && <label className="block text-sm">{kind === "CONFRONT" ? "Question" : "Explanation"}<textarea className="text-input mt-2" value={statement} onChange={e => setStatement(e.target.value)} maxLength={500} required /></label>}
      {kind === "ABILITY" && <p className="text-sm text-muted">{self.ability?.description}</p>}
      <button className="primary-button w-full" disabled={busy || !connected || remaining === 0}>Save action</button><p className="text-sm text-muted" role="status">Selected: {self.selectedAction?.kind.replaceAll("_", " ") ?? "None (defaults to PASS)"}</p>
    </form></details>}
    {room.accusationMarkers.length > 0 && <section aria-label="Accusations"><h2 className="font-bold">Public challenges</h2>{room.accusationMarkers.map(a => <p key={a.id} className="mt-2 text-sm">{name(a.byParticipantId)} → {name(a.targetParticipantId)}: {a.status}</p>)}</section>}
    {result && <p role="status" className="text-sm text-mint">{result}</p>}{error && <p role="alert" className="text-sm text-coral">{error}</p>}
    <p className="text-xs text-muted">{room.aiPresenceDisclosure === "HUMANS_ONLY" ? "Humans-only match." : "AI-controlled characters may participate; identities stay hidden during play."}</p>
  </section>;
}
