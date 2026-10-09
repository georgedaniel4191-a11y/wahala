"use client";

import { useState } from "react";
import type { RoleAssignment } from "@wahala/shared";

type Props = {
  card: RoleAssignment; displayName: string; connected: boolean; busy: boolean;
  acknowledged: boolean; onProceed: () => void;
};

export default function SecretRole({ card, displayName, connected, busy, acknowledged, onProceed }: Props) {
  const [revealed, setRevealed] = useState(false);
  return (
    <section aria-labelledby="secret-heading" className="space-y-6">
      <div className="text-center"><p className="eyebrow">For your eyes only</p>
        <h1 id="secret-heading" className="mt-3 text-3xl font-bold">Your secret dossier</h1>
        <p className="mt-3 text-sm text-muted">Keep your screen private. Your card belongs to you alone.</p>
      </div>
      <article className="secret-card rounded-2xl border border-gold/40 bg-surface p-6" aria-label="Confidential role card">
        <div className="mb-6 flex items-center justify-between gap-3 border-b border-divider pb-4">
          <span className="text-xs font-bold tracking-[0.16em] text-gold">CONFIDENTIAL</span>
          <span className="text-xs text-muted">WAHALA / PERSONAL FILE</span>
        </div>
        {revealed ? <>
          <h2 data-testid="persona-name" className="text-3xl font-bold text-gold">{displayName}</h2>
          <div className="mt-6 space-y-6">
            <div><h3 className="eyebrow">What you know</h3><p data-testid="starting-memory" className="mt-2 leading-relaxed">{card.startingMemory}</p></div>
            <div><h3 className="eyebrow">Your objective</h3><p data-testid="mission" className="mt-2 leading-relaxed">{card.mission.description}</p></div>
            <div><h3 className="eyebrow">Special ability</h3><p data-testid="ability" className="mt-2 leading-relaxed">{card.ability.description}</p><p className="mt-2 text-xs text-muted">One use during investigation.</p></div>
            {card.startingEvidence.length > 0 && <div><h3 className="eyebrow">Your receipts</h3>
              {card.startingEvidence.map((clue) => <div key={clue.id} className="mt-3 rounded-xl border border-mint/30 bg-background p-4"><p className="text-sm font-semibold text-mint">{clue.title} · Verified</p><p className="mt-2 text-sm leading-relaxed">{clue.body}</p></div>)}
            </div>}
          </div>
          <p className="mt-6 border-t border-divider pt-4 text-sm italic text-muted">You don&apos;t yet know the full consequence of your action.</p>
          <button type="button" className="secondary-button mt-5 w-full" onClick={() => setRevealed(false)}>Hide my card</button>
        </> : <div className="py-10 text-center"><span className="text-5xl text-gold" aria-hidden="true">◇</span><p className="mt-5 text-lg font-semibold">Your role is sealed.</p><p className="mt-2 text-sm text-muted">Reveal it when nobody else is looking.</p><button type="button" className="primary-button mt-6 w-full" onClick={() => setRevealed(true)}>Reveal my card</button></div>}
      </article>
      <button type="button" className="primary-button w-full" disabled={!connected || busy || !revealed || acknowledged} onClick={onProceed}>
        {busy ? "Confirming…" : acknowledged ? "Role acknowledged" : "Proceed to Investigation"}
      </button>
      {acknowledged && <p role="status" className="text-center text-sm text-muted">Your role is confirmed. Waiting for the other players or the server role deadline.</p>}
    </section>
  );
}
