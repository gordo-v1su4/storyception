import type { CharacterRecord } from "@/lib/storyception-schema"

interface CharacterCardProps {
  character: CharacterRecord
}

function fallbackInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?"
}

function isRenderableImage(url?: string | null): url is string {
  return typeof url === "string" && url.trim().length > 0
}

export function CharacterCard({ character }: CharacterCardProps) {
  const sheetUrl = character.sheet_image_url || character.look_sheet_image_url || character.source_image_url
  const sourceUrl = character.source_image_url
  const lookLabel = character.look_label || "Default"

  return (
    <article className="w-[300px] overflow-hidden rounded-2xl border border-violet-400/30 bg-zinc-950/95 shadow-2xl shadow-violet-950/30">
      <div className="border-b border-violet-400/20 bg-gradient-to-r from-violet-500/15 via-cyan-500/10 to-zinc-900 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-violet-300">Character</p>
            <h3 className="mt-1 line-clamp-2 text-base font-semibold text-zinc-100">{character.name}</h3>
          </div>
          <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-cyan-200">
            {character.kind}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_76px] gap-3 p-3">
        <div className="flex aspect-[4/5] items-center justify-center overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
          {isRenderableImage(sheetUrl) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={sheetUrl} alt={`${character.name} character sheet`} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-violet-950 to-zinc-950 text-4xl font-black text-violet-300">
              {fallbackInitial(character.name)}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <div className="aspect-square overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
            {isRenderableImage(sourceUrl) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={sourceUrl} alt={`${character.name} source reference`} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[10px] text-zinc-500">No source</div>
            )}
          </div>
          <span className="rounded-md border border-emerald-400/30 bg-emerald-400/10 px-2 py-1 text-center text-[10px] font-semibold text-emerald-200">
            {lookLabel}
          </span>
          <button
            type="button"
            disabled
            className="rounded-md border border-dashed border-zinc-700 px-2 py-1 text-[10px] text-zinc-500"
            title="Additional looks are planned after v1"
          >
            + Add look
          </button>
        </div>
      </div>

      {character.descriptor ? (
        <p className="line-clamp-3 border-t border-zinc-800 px-4 py-3 text-xs leading-relaxed text-zinc-400">
          {character.descriptor}
        </p>
      ) : null}
    </article>
  )
}
