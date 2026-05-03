import { useMemo, useRef, useState } from "react";
import { ARCHETYPES, OUTCOMES, CATEGORIES, type Archetype, type Outcome } from "./data";

type RefImage = { id: string; url: string; name: string };

const accentText: Record<string, string> = {
  cyan: "text-sky-400",
  fuchsia: "text-violet-400",
  amber: "text-amber-400",
};

export default function App() {
  const [archetype, setArchetype] = useState<Archetype | null>(null);
  const [hovered, setHovered] = useState<Archetype | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [images, setImages] = useState<RefImage[]>([]);
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("All");
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(
    () => (category === "All" ? ARCHETYPES : ARCHETYPES.filter((a) => a.category === category)),
    [category]
  );

  const completion = useMemo(() => {
    let score = 0;
    if (archetype) score += 1;
    if (images.length > 0) score += 1;
    if (outcome) score += 1;
    return score;
  }, [archetype, images, outcome]);

  const ready = completion === 3;

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const next: RefImage[] = [];
    Array.from(files)
      .slice(0, 3 - images.length)
      .forEach((f) => {
        if (!f.type.startsWith("image/")) return;
        next.push({ id: `${f.name}-${Date.now()}-${Math.random()}`, url: URL.createObjectURL(f), name: f.name });
      });
    setImages((prev) => [...prev, ...next].slice(0, 3));
  };

  const removeImage = (id: string) => setImages((prev) => prev.filter((i) => i.id !== id));

  const showcase = hovered ?? archetype;

  return (
    <div className="min-h-screen bg-[#1e1f22] text-neutral-200 font-sans antialiased selection:bg-sky-500/30">
      {/* ============== TITLE BAR ============== */}
      <header className="h-9 bg-[#2b2d30] border-b border-black/40 flex items-center px-3 text-[12px] text-neutral-400 select-none">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-sm bg-sky-600 flex items-center justify-center text-[10px] font-bold text-white">S</div>
          <span className="text-neutral-300">StoryGen</span>
          <span className="text-neutral-600">—</span>
          <span>New Story</span>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <button className="w-7 h-7 hover:bg-white/5 flex items-center justify-center text-neutral-500" title="Minimize">—</button>
          <button className="w-7 h-7 hover:bg-white/5 flex items-center justify-center text-neutral-500" title="Maximize">▢</button>
          <button className="w-7 h-7 hover:bg-red-600 flex items-center justify-center text-neutral-500 hover:text-white" title="Close">✕</button>
        </div>
      </header>

      {/* ============== MENU BAR ============== */}
      <div className="h-7 bg-[#2b2d30] border-b border-black/40 flex items-center px-2 text-[12px] text-neutral-300 select-none gap-1">
        {["File", "Edit", "View", "Story", "Tools", "Help"].map((m) => (
          <button key={m} className="px-2 h-6 hover:bg-white/10 rounded-sm">{m}</button>
        ))}
      </div>

      {/* ============== TOOLBAR ============== */}
      <div className="h-10 bg-[#2b2d30] border-b border-black/40 flex items-center px-3 gap-3 text-[12px] text-neutral-300">
        <div className="flex items-center gap-1">
          <button className="px-2 h-7 hover:bg-white/10 rounded-sm border border-transparent hover:border-white/10" title="New">＋ New</button>
          <button className="px-2 h-7 hover:bg-white/10 rounded-sm border border-transparent hover:border-white/10" title="Open">⌂ Open</button>
          <button className="px-2 h-7 hover:bg-white/10 rounded-sm border border-transparent hover:border-white/10" title="Save">💾 Save</button>
        </div>
        <div className="w-px h-5 bg-black/40" />
        <div className="flex items-center gap-2 text-neutral-500">
          <span>Project</span>
          <span className="text-neutral-600">›</span>
          <span className="text-neutral-300">Untitled Story</span>
        </div>
        <div className="ml-auto flex items-center gap-2 text-[11px] text-neutral-500">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span>Ready</span>
        </div>
      </div>

      {/* ============== MAIN ============== */}
      <main className="p-3">
        <div className="grid grid-cols-12 gap-3 h-[calc(100vh-9rem)]">
          {/* ============== LEFT: BUILDER ============== */}
          <section className="col-span-8 bg-[#1e1f22] border border-black/40 rounded-sm flex flex-col overflow-hidden">
            {/* Panel header */}
            <div className="h-9 bg-[#2b2d30] border-b border-black/40 flex items-center px-3 text-[11px] uppercase tracking-wider text-neutral-400">
              <span className="text-neutral-200 font-medium">Story Configuration</span>
              <span className="ml-3 text-neutral-600 normal-case tracking-normal">— Choose your narrative structure</span>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto">
              {/* === Step 1: Archetype === */}
              <Section number={1} title="Narrative Archetype" status={archetype ? "done" : "pending"}>
                <div className="flex items-center gap-1 mb-3 flex-wrap">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c}
                      onClick={() => setCategory(c)}
                      className={`px-2.5 h-7 text-[12px] border rounded-sm transition-colors ${
                        category === c
                          ? "bg-sky-600 border-sky-700 text-white"
                          : "bg-[#2b2d30] border-black/40 text-neutral-300 hover:bg-[#35373b]"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                  <span className="ml-auto text-[11px] text-neutral-500">{filtered.length} templates</span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {filtered.map((a) => {
                    const selected = archetype?.id === a.id;
                    return (
                      <button
                        key={a.id}
                        onClick={() => setArchetype(a)}
                        onMouseEnter={() => setHovered(a)}
                        onMouseLeave={() => setHovered(null)}
                        className={`text-left p-3 border rounded-sm transition-colors ${
                          selected
                            ? "bg-sky-950/40 border-sky-700"
                            : "bg-[#2b2d30] border-black/40 hover:bg-[#35373b] hover:border-neutral-600"
                        }`}
                      >
                        <div className="flex items-start justify-between mb-1.5">
                          <div className="text-[13px] font-medium text-neutral-100 leading-tight">{a.name}</div>
                          {selected && (
                            <div className="w-4 h-4 rounded-sm bg-sky-600 flex items-center justify-center text-white text-[10px] shrink-0 ml-2">
                              ✓
                            </div>
                          )}
                        </div>
                        <div className={`text-[10px] uppercase tracking-wider mb-2 ${accentText[a.accent]}`}>
                          {a.engine}
                        </div>
                        <div className="text-[12px] text-neutral-400 leading-snug mb-3 min-h-[2.5rem]">
                          {a.description}
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-black/40 text-[11px]">
                          <span className="text-neutral-500 italic truncate pr-2">{a.examples}</span>
                          <span className="text-neutral-400 tabular-nums shrink-0">{a.beats} beats</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </Section>

              <Divider />

              {/* === Step 2: References === */}
              <Section number={2} title="Reference Images" status={images.length > 0 ? "done" : "pending"} subtitle="Optional · 1–3 images">
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDrag(true);
                  }}
                  onDragLeave={() => setDrag(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDrag(false);
                    handleFiles(e.dataTransfer.files);
                  }}
                  onClick={() => fileRef.current?.click()}
                  className={`border border-dashed rounded-sm p-4 cursor-pointer transition-colors ${
                    drag ? "border-sky-500 bg-sky-950/30" : "border-neutral-700 bg-[#2b2d30] hover:bg-[#35373b]"
                  }`}
                >
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => handleFiles(e.target.files)}
                  />
                  <div className="grid grid-cols-3 gap-2">
                    {[0, 1, 2].map((i) => {
                      const img = images[i];
                      if (img) {
                        return (
                          <div key={img.id} className="relative aspect-[4/3] bg-black border border-black/40 rounded-sm overflow-hidden group">
                            <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                removeImage(img.id);
                              }}
                              className="absolute top-1 right-1 w-5 h-5 rounded-sm bg-black/80 hover:bg-red-600 text-white text-[11px] flex items-center justify-center opacity-0 group-hover:opacity-100"
                              title="Remove"
                            >
                              ✕
                            </button>
                            <div className="absolute bottom-0 inset-x-0 bg-black/70 text-[10px] text-neutral-300 px-1.5 py-0.5 truncate">
                              {img.name}
                            </div>
                          </div>
                        );
                      }
                      return (
                        <div
                          key={i}
                          className="aspect-[4/3] border border-dashed border-neutral-700 rounded-sm flex flex-col items-center justify-center text-neutral-600 text-[11px] gap-1"
                        >
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <rect x="3" y="3" width="18" height="18" rx="1" />
                            <circle cx="8.5" cy="8.5" r="1.5" />
                            <path d="m21 15-5-5L5 21" />
                          </svg>
                          <span>Slot {i + 1}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[11px] text-neutral-500">
                    <span>Drag and drop image files, or click to browse</span>
                    <span className="tabular-nums">{images.length} / 3</span>
                  </div>
                </div>
              </Section>

              <Divider />

              {/* === Step 3: Outcome === */}
              <Section number={3} title="Story Outcome" status={outcome ? "done" : "pending"}>
                <div className="grid grid-cols-2 gap-2">
                  {OUTCOMES.map((o) => {
                    const selected = outcome?.id === o.id;
                    return (
                      <button
                        key={o.id}
                        onClick={() => setOutcome(o)}
                        className={`flex items-start gap-3 text-left p-3 border rounded-sm transition-colors ${
                          selected
                            ? "bg-sky-950/40 border-sky-700"
                            : "bg-[#2b2d30] border-black/40 hover:bg-[#35373b] hover:border-neutral-600"
                        }`}
                      >
                        <div
                          className={`mt-0.5 w-3.5 h-3.5 rounded-full border shrink-0 flex items-center justify-center ${
                            selected ? "border-sky-500 bg-sky-500" : "border-neutral-500"
                          }`}
                        >
                          {selected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                        <div className="min-w-0">
                          <div className="text-[13px] font-medium text-neutral-100">{o.name}</div>
                          <div className="text-[12px] text-neutral-400 leading-snug mt-0.5">{o.description}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </Section>
            </div>
          </section>

          {/* ============== RIGHT: PREVIEW / INSPECTOR ============== */}
          <aside className="col-span-4 bg-[#1e1f22] border border-black/40 rounded-sm flex flex-col overflow-hidden">
            {/* Panel header */}
            <div className="h-9 bg-[#2b2d30] border-b border-black/40 flex items-center px-3 text-[11px] uppercase tracking-wider">
              <span className="text-neutral-200 font-medium">Inspector</span>
              <span className="ml-auto text-neutral-500 normal-case tracking-normal">{completion}/3 complete</span>
            </div>

            {/* Progress bar */}
            <div className="h-1 bg-black/40">
              <div
                className="h-full bg-sky-600 transition-all"
                style={{ width: `${(completion / 3) * 100}%` }}
              />
            </div>

            {/* Inspector body */}
            <div className="flex-1 overflow-y-auto">
              {/* Archetype block */}
              <InspectorBlock label="Archetype">
                {showcase ? (
                  <div>
                    <div className="text-[13px] font-medium text-neutral-100">{showcase.name}</div>
                    <div className={`text-[10px] uppercase tracking-wider mt-0.5 ${accentText[showcase.accent]}`}>
                      {showcase.engine}
                    </div>
                    <div className="text-[11px] text-neutral-500 mt-1.5 italic">{showcase.examples}</div>
                  </div>
                ) : (
                  <Empty>No archetype selected</Empty>
                )}
              </InspectorBlock>

              {/* Beat sheet */}
              <InspectorBlock label={`Beat Structure ${showcase ? `(${showcase.beatList.length})` : ""}`}>
                {showcase ? (
                  <ol className="space-y-px">
                    {showcase.beatList.map((b: string, i: number) => (
                      <li
                        key={i}
                        className="flex items-center gap-2 text-[12px] text-neutral-300 px-2 h-6 hover:bg-white/5 rounded-sm"
                      >
                        <span className="text-neutral-600 tabular-nums w-5 text-right">{String(i + 1).padStart(2, "0")}</span>
                        <span className="text-neutral-500">·</span>
                        <span className="truncate">{b}</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <Empty>Beats will appear here</Empty>
                )}
              </InspectorBlock>

              {/* References */}
              <InspectorBlock label={`References (${images.length})`}>
                {images.length > 0 ? (
                  <div className="grid grid-cols-3 gap-1.5">
                    {images.map((img) => (
                      <div key={img.id} className="aspect-square bg-black border border-black/40 rounded-sm overflow-hidden">
                        <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <Empty>No images attached</Empty>
                )}
              </InspectorBlock>

              {/* Outcome */}
              <InspectorBlock label="Outcome">
                {outcome ? (
                  <div>
                    <div className="text-[13px] font-medium text-neutral-100">{outcome.name}</div>
                    <div className="text-[11px] text-neutral-500 mt-0.5">{outcome.description}</div>
                  </div>
                ) : (
                  <Empty>No outcome chosen</Empty>
                )}
              </InspectorBlock>

              {/* Validation summary */}
              <InspectorBlock label="Validation">
                <ul className="text-[12px] space-y-1">
                  <CheckRow ok={!!archetype} label="Archetype selected" />
                  <CheckRow ok={images.length > 0} label="At least one reference image" optional />
                  <CheckRow ok={!!outcome} label="Outcome chosen" />
                </ul>
              </InspectorBlock>
            </div>

            {/* Action footer */}
            <div className="border-t border-black/40 bg-[#2b2d30] p-2 flex items-center gap-2">
              <button
                onClick={() => {
                  setArchetype(null);
                  setOutcome(null);
                  setImages([]);
                  setCategory("All");
                }}
                className="px-3 h-8 text-[12px] bg-[#3c3f44] border border-black/40 hover:bg-[#474a4f] text-neutral-200 rounded-sm"
              >
                Reset
              </button>
              <button
                disabled={!ready}
                className={`flex-1 h-8 text-[12px] font-medium rounded-sm border transition-colors ${
                  ready
                    ? "bg-sky-600 border-sky-700 hover:bg-sky-500 text-white"
                    : "bg-[#3c3f44] border-black/40 text-neutral-500 cursor-not-allowed"
                }`}
              >
                {ready ? "Generate Story →" : `Complete ${3 - completion} more step${3 - completion === 1 ? "" : "s"}`}
              </button>
            </div>
          </aside>
        </div>
      </main>

      {/* ============== STATUS BAR ============== */}
      <footer className="h-6 bg-[#2b2d30] border-t border-black/40 flex items-center px-3 text-[11px] text-neutral-500 gap-4">
        <span className="flex items-center gap-1.5">
          <span className={`inline-block w-1.5 h-1.5 rounded-full ${ready ? "bg-emerald-500" : "bg-amber-500"}`} />
          {ready ? "Ready to generate" : "Awaiting input"}
        </span>
        <span>Archetype: {archetype?.name ?? "—"}</span>
        <span>Images: {images.length}/3</span>
        <span>Outcome: {outcome?.name ?? "—"}</span>
        <span className="ml-auto">UTF-8</span>
        <span>StoryGen v1.0.0</span>
      </footer>
    </div>
  );
}

/* ---------- Sub-components ---------- */

function Section({
  number,
  title,
  subtitle,
  status,
  children,
}: {
  number: number;
  title: string;
  subtitle?: string;
  status: "done" | "pending";
  children: React.ReactNode;
}) {
  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <div
          className={`w-5 h-5 rounded-sm flex items-center justify-center text-[11px] font-medium ${
            status === "done" ? "bg-sky-600 text-white" : "bg-[#3c3f44] text-neutral-400 border border-black/40"
          }`}
        >
          {status === "done" ? "✓" : number}
        </div>
        <h2 className="text-[13px] font-medium text-neutral-100 uppercase tracking-wide">{title}</h2>
        {subtitle && <span className="text-[11px] text-neutral-500">{subtitle}</span>}
      </div>
      {children}
    </div>
  );
}

function Divider() {
  return <div className="h-px bg-black/40 mx-4" />;
}

function InspectorBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-black/40">
      <div className="px-3 h-7 flex items-center bg-[#26282b] text-[10px] uppercase tracking-wider text-neutral-500 font-medium">
        {label}
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-[12px] text-neutral-600 italic">{children}</div>;
}

function CheckRow({ ok, label, optional }: { ok: boolean; label: string; optional?: boolean }) {
  return (
    <li className="flex items-center gap-2 text-neutral-400">
      <span
        className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center text-[9px] ${
          ok ? "bg-emerald-600 border-emerald-700 text-white" : "bg-[#2b2d30] border-neutral-700 text-transparent"
        }`}
      >
        ✓
      </span>
      <span className={ok ? "text-neutral-200" : ""}>{label}</span>
      {optional && <span className="text-[10px] text-neutral-600 ml-auto">optional</span>}
    </li>
  );
}
