import { useState, useCallback, useRef } from 'react';
import { archetypes, outcomes } from './data/archetypes';

export default function App() {
  const [selectedArchetype, setSelectedArchetype] = useState<string | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [selectedOutcome, setSelectedOutcome] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const allDone = !!selectedArchetype && images.length > 0 && !!selectedOutcome;

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return;
      const remaining = 3 - images.length;
      if (remaining <= 0) return;
      const newImages: string[] = [];
      const filesToProcess = Array.from(files).slice(0, remaining);
      filesToProcess.forEach((file) => {
        if (!file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = (e) => {
          newImages.push(e.target?.result as string);
          if (newImages.length === filesToProcess.length) {
            setImages((prev) => [...prev, ...newImages]);
          }
        };
        reader.readAsDataURL(file);
      });
    },
    [images.length]
  );

  const rows = [
    archetypes.filter((a) => a.category === 'narrative').slice(0, 3),
    archetypes.filter((a) => a.category === 'narrative').slice(3, 6),
    archetypes.filter((a) => a.category === 'music'),
    archetypes.filter((a) => a.category === 'commercial'),
  ];

  return (
    <div className="h-full flex flex-col bg-[#0a0a0a] text-[#a0a0a0]">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[#1a1a1a]">
        <div className="flex items-center gap-2.5">
          <svg className="w-5 h-5 text-[#555]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
            <path d="m7 2 0 20" />
            <path d="m17 2 0 20" />
            <path d="M2 12h20" />
            <path d="M2 7h5" />
            <path d="M2 17h5" />
            <path d="M17 7h5" />
            <path d="M17 17h5" />
          </svg>
          <span className="text-[13px] font-medium text-[#ccc] tracking-tight">Create New Story</span>
          <span className="text-[11px] text-[#444] ml-1">— choose structure, add references, pick outcome</span>
        </div>
        <button className="text-[#444] hover:text-[#888] transition-colors cursor-pointer">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18" /><path d="m6 6 12 12" />
          </svg>
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex min-h-0">
        {/* LEFT — Archetype grid */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-[#1a1a1a]">
          <div className="px-5 pt-3 pb-1.5">
            <span className="text-[10px] font-medium tracking-[0.1em] text-[#444] uppercase">1 · Narrative Archetype</span>
          </div>
          <div className="flex-1 overflow-y-auto px-5 pb-4">
            <div className="grid grid-cols-3 gap-px bg-[#1a1a1a] rounded-lg overflow-hidden">
              {rows.flat().map((a) => {
                const sel = selectedArchetype === a.id;
                return (
                  <button
                    key={a.id}
                    onClick={() => setSelectedArchetype(sel ? null : a.id)}
                    className={`relative text-left p-3 transition-colors duration-100 cursor-pointer
                      ${sel ? 'bg-[#141414] ring-1 ring-white/[0.12] z-10' : 'bg-[#0e0e0e] hover:bg-[#131313]'}
                    `}
                  >
                    {sel && (
                      <div className="absolute top-2 right-2 w-3.5 h-3.5 rounded-full bg-white flex items-center justify-center">
                        <svg className="w-2.5 h-2.5 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                    )}
                    <div className="text-[12px] font-semibold text-[#e0e0e0] tracking-wide uppercase leading-tight">
                      {a.name}
                    </div>
                    <div className="text-[9px] font-medium tracking-[0.08em] text-[#555] uppercase mt-0.5">
                      {a.engine}
                    </div>
                    <div className="text-[11px] text-[#666] mt-1.5 leading-snug">
                      {a.description}
                    </div>
                    <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-[#1a1a1a]">
                      <span className="text-[9px] text-[#3a3a3a]">{a.tags}</span>
                      <span className="text-[9px] text-[#3a3a3a] tabular-nums">{a.beats}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT — Images + Outcome stacked */}
        <div className="w-[280px] flex-shrink-0 flex flex-col">
          {/* Reference images */}
          <div className="flex-1 flex flex-col border-b border-[#1a1a1a]">
            <div className="px-4 pt-3 pb-1.5">
              <span className="text-[10px] font-medium tracking-[0.1em] text-[#444] uppercase">2 · Reference Images</span>
            </div>
            <div className="flex-1 px-4 pb-3 flex flex-col">
              {/* Thumbnails */}
              {images.length > 0 && (
                <div className="flex gap-1.5 mb-2">
                  {images.map((src, i) => (
                    <div key={i} className="relative group w-16 h-16 rounded overflow-hidden bg-[#111]">
                      <img src={src} alt="" className="w-full h-full object-cover" />
                      <button
                        onClick={() => setImages(images.filter((_, idx) => idx !== i))}
                        className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      >
                        <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Drop zone */}
              {images.length < 3 && (
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files); }}
                  onClick={() => inputRef.current?.click()}
                  className={`flex-1 flex flex-col items-center justify-center rounded-lg border border-dashed cursor-pointer transition-colors
                    ${isDragging ? 'border-[#444] bg-[#111]' : 'border-[#1e1e1e] hover:border-[#333] bg-transparent'}
                  `}
                >
                  <svg className="w-5 h-5 text-[#2a2a2a] mb-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                    <circle cx="9" cy="9" r="2" />
                    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                  </svg>
                  <span className="text-[10px] text-[#333]">Drop or click · {images.length}/3</span>
                  <input
                    ref={inputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
                  />
                </div>
              )}
              {images.length >= 3 && (
                <div className="flex-1 flex items-center justify-center">
                  <span className="text-[10px] text-[#333]">3/3 images added</span>
                </div>
              )}
            </div>
          </div>

          {/* Story Outcome */}
          <div className="flex-1 flex flex-col">
            <div className="px-4 pt-3 pb-1.5">
              <span className="text-[10px] font-medium tracking-[0.1em] text-[#444] uppercase">3 · Story Outcome</span>
            </div>
            <div className="flex-1 px-4 pb-3 flex flex-col gap-px">
              {outcomes.map((o) => {
                const sel = selectedOutcome === o.id;
                return (
                  <button
                    key={o.id}
                    onClick={() => setSelectedOutcome(sel ? null : o.id)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors duration-100 cursor-pointer
                      ${sel ? 'bg-[#161616]' : 'bg-transparent hover:bg-[#111]'}
                    `}
                  >
                    <div className={`w-3 h-3 rounded-full border-[1.5px] flex items-center justify-center flex-shrink-0
                      ${sel ? 'border-white' : 'border-[#333]'}
                    `}>
                      {sel && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                    <div>
                      <div className={`text-[11px] font-semibold tracking-wide uppercase ${sel ? 'text-white' : 'text-[#888]'}`}>
                        {o.name}
                      </div>
                      <div className="text-[10px] text-[#444] leading-tight mt-0.5">
                        {o.description}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="flex items-center justify-between px-5 py-2.5 border-t border-[#1a1a1a]">
        <div className="flex items-center gap-5">
          {[
            { label: 'Archetype', done: !!selectedArchetype },
            { label: 'Images', done: images.length > 0 },
            { label: 'Outcome', done: !!selectedOutcome },
          ].map((s, i) => (
            <div key={i} className="flex items-center gap-1.5">
              {s.done ? (
                <svg className="w-3 h-3 text-[#666]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <div className="w-1 h-1 rounded-full bg-[#333]" />
              )}
              <span className={`text-[11px] ${s.done ? 'text-[#777]' : 'text-[#333]'}`}>
                {s.label}
              </span>
            </div>
          ))}
        </div>
        <button
          disabled={!allDone}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-[11px] font-medium tracking-wide uppercase transition-colors cursor-pointer
            ${allDone
              ? 'bg-white text-black hover:bg-[#e0e0e0] active:bg-[#ccc]'
              : 'bg-[#141414] text-[#333] cursor-not-allowed'
            }
          `}
        >
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          Begin Story
        </button>
      </div>
    </div>
  );
}
