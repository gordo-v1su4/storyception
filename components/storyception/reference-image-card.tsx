interface ReferenceImageCardProps {
  url: string
  index: number
}

export function ReferenceImageCard({ url, index }: ReferenceImageCardProps) {
  return (
    <article className="w-[220px] overflow-hidden rounded-2xl border border-cyan-400/30 bg-zinc-950/95 shadow-2xl shadow-cyan-950/30">
      <div className="aspect-[4/5] overflow-hidden bg-zinc-900">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={`Reference ${index + 1}`} className="h-full w-full object-cover" />
      </div>
      <p className="border-t border-zinc-800 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-300">
        Reference {index + 1}
      </p>
    </article>
  )
}
