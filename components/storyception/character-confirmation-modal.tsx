"use client"

import type { CharacterKind, CharacterRecord } from "@/lib/storyception-schema"

type CharacterDetectionCandidate = {
  imageUrl: string
  kind: CharacterKind
  suggestedName?: string
  descriptor?: string
  confidence?: number
}

export type CharacterConfirmationDraft = {
  id: string
  imageUrl: string
  kind: CharacterKind
  name: string
  descriptor: string
  confidence: number
}

export type CharacterSheetProgress = {
  phase: "idle" | "sheet" | "looksheet" | "done" | "error"
  message?: string
}

interface CharacterConfirmationModalProps {
  candidates: CharacterDetectionCandidate[]
  drafts: CharacterConfirmationDraft[]
  onDraftChange: (
    id: string,
    updates: Partial<CharacterConfirmationDraft>,
  ) => void
  onMakeSheets: () => void
  onSkip: () => void
  onCancel: () => void
  isBusy?: boolean
  error?: string | null
  progress?: Record<string, CharacterSheetProgress>
  generatedCharacters?: CharacterRecord[]
}

const KIND_OPTIONS: CharacterKind[] = [
  "character",
  "environment",
  "prop",
  "unknown",
]

export function CharacterConfirmationModal({
  candidates,
  drafts,
  onDraftChange,
  onMakeSheets,
  onSkip,
  onCancel,
  isBusy = false,
  error,
  progress = {},
  generatedCharacters = [],
}: CharacterConfirmationModalProps) {
  const characterCount = drafts.filter(
    (draft) => draft.kind === "character",
  ).length

  return (
    <div className="absolute inset-0 z-[120] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="flex max-h-[min(760px,92dvh)] w-full max-w-5xl flex-col overflow-hidden rounded-sm border border-[#252525] bg-[#0b0b0b] shadow-2xl">
        <header className="flex h-12 flex-shrink-0 items-center border-b border-[#1a1a1a] bg-[#101010] px-4">
          <div>
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[#e0e0e0]">
              Confirm characters
            </h2>
            <p className="text-[11px] text-[#666]">
              Review detected subjects before story generation. Sheets are
              optional; raw references still work.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isBusy}
            className="ml-auto flex h-7 w-7 items-center justify-center rounded-sm text-[#555] hover:bg-white/[0.05] hover:text-[#aaa] disabled:cursor-not-allowed disabled:opacity-40"
            title="Cancel confirmation"
          >
            ✕
          </button>
        </header>

        {error && (
          <div className="flex-shrink-0 border-b border-red-500/40 bg-red-950/40 px-4 py-2 text-[12px] text-red-300">
            {error}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] text-[#666]">
            <span className="rounded-sm border border-[#252525] bg-[#111] px-2 py-1">
              {candidates.length} detected
            </span>
            <span className="rounded-sm border border-[#252525] bg-[#111] px-2 py-1">
              {characterCount} character refs
            </span>
            {generatedCharacters.length > 0 && (
              <span className="rounded-sm border border-emerald-900/60 bg-emerald-950/30 px-2 py-1 text-emerald-300">
                {generatedCharacters.length} sheet records ready
              </span>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {drafts.map((draft, index) => {
              const itemProgress = progress[draft.id]
              return (
                <article
                  key={draft.id}
                  className="overflow-hidden rounded-sm border border-[#1a1a1a] bg-[#101010]"
                >
                  <div className="relative aspect-[4/3] bg-black">
                    <img
                      src={draft.imageUrl}
                      alt={draft.name || `Reference ${index + 1}`}
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute left-2 top-2 rounded-sm bg-black/75 px-2 py-1 text-[10px] uppercase tracking-wide text-[#ccc]">
                      {Math.round(draft.confidence * 100)}% confidence
                    </div>
                  </div>
                  <div className="space-y-3 p-3">
                    <label className="block text-[10px] font-medium uppercase tracking-wider text-[#666]">
                      Name
                      <input
                        value={draft.name}
                        onChange={(event) =>
                          onDraftChange(draft.id, { name: event.target.value })
                        }
                        disabled={isBusy}
                        className="mt-1 h-8 w-full rounded-sm border border-[#252525] bg-[#0b0b0b] px-2 text-[12px] normal-case tracking-normal text-[#ddd] outline-none focus:border-cyan-700 disabled:opacity-50"
                      />
                    </label>
                    <label className="block text-[10px] font-medium uppercase tracking-wider text-[#666]">
                      Descriptor
                      <textarea
                        value={draft.descriptor}
                        onChange={(event) =>
                          onDraftChange(draft.id, {
                            descriptor: event.target.value,
                          })
                        }
                        disabled={isBusy}
                        rows={3}
                        className="mt-1 w-full resize-none rounded-sm border border-[#252525] bg-[#0b0b0b] px-2 py-1.5 text-[12px] normal-case leading-snug tracking-normal text-[#ddd] outline-none focus:border-cyan-700 disabled:opacity-50"
                      />
                    </label>
                    <label className="block text-[10px] font-medium uppercase tracking-wider text-[#666]">
                      Kind
                      <select
                        value={draft.kind}
                        onChange={(event) =>
                          onDraftChange(draft.id, {
                            kind: event.target.value as CharacterKind,
                          })
                        }
                        disabled={isBusy}
                        className="mt-1 h-8 w-full rounded-sm border border-[#252525] bg-[#0b0b0b] px-2 text-[12px] normal-case tracking-normal text-[#ddd] outline-none focus:border-cyan-700 disabled:opacity-50"
                      >
                        {KIND_OPTIONS.map((kind) => (
                          <option key={kind} value={kind}>
                            {kind}
                          </option>
                        ))}
                      </select>
                    </label>
                    {itemProgress && itemProgress.phase !== "idle" && (
                      <div
                        className={`rounded-sm border px-2 py-1.5 text-[11px] ${
                          itemProgress.phase === "error"
                            ? "border-red-900/70 bg-red-950/25 text-red-300"
                            : itemProgress.phase === "done"
                              ? "border-emerald-900/70 bg-emerald-950/25 text-emerald-300"
                              : "border-cyan-900/70 bg-cyan-950/25 text-cyan-300"
                        }`}
                      >
                        {itemProgress.message ?? itemProgress.phase}
                      </div>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        </div>

        <footer className="flex flex-shrink-0 flex-wrap items-center gap-2 border-t border-[#1a1a1a] bg-[#101010] p-3">
          <p className="mr-auto text-[11px] text-[#666]">
            Make sheets for confirmed characters, or skip to generate using only
            uploaded references.
          </p>
          <button
            type="button"
            onClick={onSkip}
            disabled={isBusy}
            className="h-8 rounded-sm border border-[#252525] bg-[#141414] px-3 text-[12px] text-[#ccc] hover:bg-[#1a1a1a] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Skip — use raw refs
          </button>
          <button
            type="button"
            onClick={onMakeSheets}
            disabled={isBusy || characterCount === 0}
            className="h-8 rounded-sm border border-cyan-700 bg-cyan-600 px-3 text-[12px] font-medium text-[#0a0a0a] hover:bg-cyan-500 disabled:cursor-not-allowed disabled:border-[#252525] disabled:bg-[#141414] disabled:text-[#555]"
          >
            {isBusy ? "Working…" : "Make sheets"}
          </button>
        </footer>
      </div>
    </div>
  )
}
