import { useEffect, useMemo, useRef, useState } from "react";

type Photo = { id: string; src: string; caption?: string };
type Album = { id: string; name: string; photos: Photo[] };
type RGB = [number, number, number];

const A = "/assets";
const initialAlbums: Album[] = [
  {
    id: "outdoors",
    name: "Outdoors",
    photos: [
      { id: "cherry", src: `${A}/ef769.webp` },
      { id: "falls", src: `${A}/5e747.webp` },
      { id: "horses", src: `${A}/a6d9f.webp` },
    ],
  },
  {
    id: "city",
    name: "City",
    photos: [
      { id: "city", src: `${A}/f188f.webp` },
      { id: "glass", src: `${A}/06743.webp` },
    ],
  },
];

const FALLBACK: RGB = [67, 64, 156];
const cache = new Map<string, RGB>();

function accentOf(src: string): Promise<RGB> {
  if (cache.has(src)) return Promise.resolve(cache.get(src)!);
  return new Promise((res) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = c.height = 24;
        const ctx = c.getContext("2d")!;
        ctx.drawImage(img, 0, 0, 24, 24);
        const d = ctx.getImageData(0, 0, 24, 24).data;
        let best = FALLBACK;
        let score = -1;
        let r = 0, g = 0, b = 0;
        for (let i = 0; i < d.length; i += 4) {
          r += d[i]; g += d[i + 1]; b += d[i + 2];
          const mx = Math.max(d[i], d[i + 1], d[i + 2]);
          const mn = Math.min(d[i], d[i + 1], d[i + 2]);
          const s = (mx - mn) * (1 - Math.abs(mx - 150) / 255);
          if (s > score) { score = s; best = [d[i], d[i + 1], d[i + 2]]; }
        }
        const n = d.length / 4;
        const avg = [r / n, g / n, b / n];
        const mix = best.map((v, k) => Math.round(v * 0.7 + avg[k] * 0.3)) as RGB;
        cache.set(src, mix);
        res(mix);
      } catch {
        res(FALLBACK);
      }
    };
    img.onerror = () => res(FALLBACK);
    img.src = src;
  });
}

// blend toward black (t<0) or white (t>0)
const tone = (c: RGB, t: number) =>
  `rgb(${c.map((v) => Math.round(t < 0 ? v * (1 + t) : v + (255 - v) * t)).join(",")})`;

function useDark() {
  const q = "(prefers-color-scheme: dark)";
  const [dark, setDark] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const f = () => setDark(m.matches);
    m.addEventListener("change", f);
    return () => m.removeEventListener("change", f);
  }, []);
  return dark;
}

const TRACK = 588;
const THUMB = 133;

export default function App() {
  const [albums, setAlbums] = useState<Album[]>(initialAlbums);
  const [pos, setPos] = useState(2); // global position across all albums
  const [dragging, setDragging] = useState(false);
  const [full, setFull] = useState(false);
  const [dropHover, setDropHover] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [accent, setAccent] = useState(FALLBACK);
  const dark = useDark();
  const trackRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const grab = useRef(0);

  const starts = useMemo(() => {
    let s = 0;
    return albums.map((a) => { const v = s; s += a.photos.length; return v; });
  }, [albums]);
  const total = albums.reduce((n, a) => n + a.photos.length, 0);
  const max = total - 1;
  const current = Math.round(pos);
  const ai = starts.reduce((r, s, i) => (s <= current ? i : r), 0);
  const album = albums[ai];
  const local = current - starts[ai];
  const localPos = pos - starts[ai];
  const photo = album.photos[local];

  useEffect(() => {
    let live = true;
    accentOf(photo.src).then((c) => live && setAccent(c));
    return () => { live = false; };
  }, [photo.src]);

  const go = (i: number) => setPos(Math.max(0, Math.min(max, i)));

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT") return;
      if (e.key === "ArrowRight") go(current + 1);
      if (e.key === "ArrowLeft") go(current - 1);
      if (e.key === "Escape") setFull(false);
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });

  // slider
  const posFromX = (clientX: number) => {
    const rect = trackRef.current!.getBoundingClientRect();
    const x = (clientX - rect.left) / (rect.width / TRACK) - grab.current;
    return Math.max(0, Math.min(max, (x / (TRACK - THUMB)) * max));
  };
  const onDown = (e: React.PointerEvent, onThumb: boolean) => {
    const rect = trackRef.current!.getBoundingClientRect();
    const thumbLeft = (max ? pos / max : 0) * (TRACK - THUMB);
    grab.current = onThumb ? (e.clientX - rect.left) / (rect.width / TRACK) - thumbLeft : THUMB / 2;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(true);
    setPos(posFromX(e.clientX));
  };
  const onMove = (e: React.PointerEvent) => dragging && setPos(posFromX(e.clientX));
  const onUp = () => { setDragging(false); setPos((p) => Math.round(p)); };

  const updateAlbum = (fn: (photos: Photo[]) => Photo[]) =>
    setAlbums((as) => as.map((a, i) => (i === ai ? { ...a, photos: fn(a.photos) } : a)));

  const addFiles = (list: FileList | null) => {
    const files = Array.from(list ?? []).filter((f) => f.type.startsWith("image/"));
    if (!files.length) return;
    const added = files.map((f, i) => ({ id: `u-${Date.now()}-${i}`, src: URL.createObjectURL(f) }));
    updateAlbum((p) => [...p, ...added]);
    setPos(starts[ai] + album.photos.length);
  };
  const remove = () => {
    if (album.photos.length <= 1) return;
    if (photo.src.startsWith("blob:")) URL.revokeObjectURL(photo.src);
    updateAlbum((p) => p.filter((_, i) => i !== local));
    setPos(starts[ai] + Math.min(local, album.photos.length - 2));
  };
  const setCaption = (id: string, caption: string) =>
    updateAlbum((p) => p.map((x) => (x.id === id ? { ...x, caption: caption.trim() || undefined } : x)));

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDropHover(false);
    addFiles(e.dataTransfer.files);
  };

  const bg = dark
    ? `radial-gradient(120% 90% at 50% 15%, ${tone(accent, -0.15)} 0%, ${tone(accent, -0.6)} 55%, ${tone(accent, -0.85)} 100%)`
    : `radial-gradient(120% 90% at 50% 15%, ${tone(accent, 0.55)} 0%, ${tone(accent, 0.25)} 55%, ${tone(accent, 0.05)} 100%)`;

  const glass =
    "border border-black/10 bg-white/40 text-neutral-900 shadow-lg hover:bg-white/60 dark:border-white/20 dark:bg-white/10 dark:text-white dark:hover:bg-white/20";

  return (
    <div
      className="relative min-h-dvh w-full overflow-hidden text-neutral-900 select-none dark:text-white"
      onDragOver={(e) => { e.preventDefault(); setDropHover(true); }}
      onDragLeave={(e) => e.currentTarget === e.target && setDropHover(false)}
      onDrop={onDrop}
    >
      <div className="absolute inset-0 transition-[background] duration-700" style={{ background: bg }} />

      <header className="relative z-10 flex flex-wrap items-center justify-between gap-4 px-6 pt-7 md:px-14">
        <nav className="flex items-center gap-1 rounded-full bg-black/5 p-1 dark:bg-white/10">
          {albums.map((a, i) => (
            <button
              key={a.id}
              onClick={() => go(starts[i] + (i === ai ? local : 0))}
              className={`rounded-full px-4 py-2 text-xs font-medium tracking-[0.2em] uppercase transition ${
                i === ai
                  ? "bg-white text-neutral-900 shadow dark:bg-white/90"
                  : "opacity-60 hover:opacity-100"
              }`}
            >
              {a.name}
              <span className="ml-2 font-mono tracking-normal opacity-50">{a.photos.length}</span>
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-4">
          <p className="font-mono text-sm tabular-nums opacity-80">
            {String(local + 1).padStart(2, "0")} / {String(album.photos.length).padStart(2, "0")}
          </p>
          <button
            onClick={() => fileRef.current?.click()}
            className={`group flex size-11 items-center justify-center rounded-full transition hover:scale-105 active:scale-95 ${glass}`}
            aria-label={`Add photos to ${album.name}`}
            title={`Add photos to ${album.name}`}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="transition-transform duration-300 group-hover:rotate-90">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
          />
        </div>
      </header>

      {/* deck */}
      <div
        key={album.id}
        className="relative z-10 mx-auto mt-4 flex h-[min(74vh,720px)] animate-[fade_.45s_ease] items-center justify-center [--s:0.58] sm:[--s:0.8] lg:[--s:1]"
      >
        {album.photos.map((p, i) => {
          const o = i - localPos;
          const a = Math.abs(o);
          if (a > 3.5) return null;
          const center = i === local;
          const sign = Math.sign(o);
          const x = sign * (Math.min(a, 1) * 290 + Math.max(0, a - 1) * 130);
          const y = Math.min(a, 2) * 38 + Math.max(0, a - 2) * 20;
          const rot = sign * Math.min(a * 9, 9 + Math.max(0, a - 1) * 9);
          const sc = a < 0.5 ? 1 : Math.max(0.7, 0.9 - (a - 1) * 0.06);
          const fog = Math.min(a, 2) / 2;
          const isEditing = editing === p.id;
          return (
            <div
              key={p.id}
              className={`absolute flex w-[424px] flex-col items-center will-change-transform ${dragging ? "" : "transition-transform duration-500 ease-[cubic-bezier(.2,.8,.2,1)]"}`}
              style={{
                transform: `scale(var(--s)) translate(${x}px, ${y + 22}px) rotate(${rot}deg) scale(${sc})`,
                zIndex: 100 - Math.round(a * 10),
              }}
            >
              <button
                onClick={() => (center ? setFull(true) : go(starts[ai] + i))}
                className={`relative h-[625px] w-full cursor-pointer overflow-hidden rounded-[30px] outline-none ${center ? "border border-black shadow-[0_30px_60px_-10px_rgba(0,0,0,.45),0_13px_15.2px_rgba(0,0,0,.25)]" : "shadow-[0_13px_15.2px_rgba(0,0,0,.25)]"}`}
                aria-label={center ? "Open full screen" : `Show photo ${i + 1}`}
              >
                <img
                  src={p.src}
                  alt={p.caption ?? ""}
                  draggable={false}
                  decoding="async"
                  className={`pointer-events-none size-full object-cover ${a > 0.5 ? "saturate-[.6] contrast-[.85]" : ""}`}
                />
                {/* fog veil — opacity only, so it stays cheap while dragging */}
                <div
                  className="pointer-events-none absolute inset-0 bg-white dark:bg-neutral-300"
                  style={{ opacity: fog * 0.34 }}
                />
              </button>

              {/* caption */}
              <div className="mt-4 flex h-9 w-full items-center justify-center" style={{ opacity: center ? 1 : 0.55 - fog * 0.4 }}>
                {isEditing ? (
                  <input
                    autoFocus
                    defaultValue={p.caption}
                    placeholder="Write a caption…"
                    maxLength={80}
                    onBlur={(e) => { setCaption(p.id, e.target.value); setEditing(null); }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      if (e.key === "Escape") setEditing(null);
                    }}
                    className="h-9 w-[80%] rounded-full border border-black/10 bg-white/70 px-4 text-center text-sm text-neutral-900 outline-none placeholder:text-neutral-500 focus:ring-2 focus:ring-black/20 dark:border-white/20 dark:bg-black/40 dark:text-white dark:placeholder:text-white/50 dark:focus:ring-white/30"
                  />
                ) : (
                  <button
                    disabled={!center}
                    onClick={() => setEditing(p.id)}
                    className="group flex max-w-full items-center gap-2 rounded-full px-3 py-1.5 text-sm transition enabled:hover:bg-black/5 dark:enabled:hover:bg-white/10"
                    aria-label={p.caption ? "Edit caption" : "Add caption"}
                    title={p.caption ? "Edit caption" : "Add caption"}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" className="shrink-0 opacity-70">
                      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" />
                    </svg>
                    {p.caption ? (
                      <span className="truncate italic">{p.caption}</span>
                    ) : (
                      center && <span className="text-xs opacity-0 transition group-hover:opacity-60">Add caption</span>
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* slider spans every album */}
      <div className="relative z-10 mx-auto w-[min(588px,72vw)] pb-14">
        <div className="relative">
          <div
            ref={trackRef}
            onPointerDown={(e) => onDown(e, false)}
            onPointerMove={onMove}
            onPointerUp={onUp}
            className="relative aspect-[588/73] w-full cursor-pointer touch-none rounded-[53px] bg-black/[0.08] opacity-[.82] dark:bg-black/25"
            role="slider"
            aria-valuemin={1}
            aria-valuemax={total}
            aria-valuenow={current + 1}
          >
            {/* album dividers */}
            {starts.slice(1).map((s, i) => (
              <div
                key={i}
                className="absolute top-1/4 h-1/2 w-px bg-black/20 dark:bg-white/25"
                style={{ left: `${((THUMB / 2 + ((s - 0.5) / max) * (TRACK - THUMB)) / TRACK) * 100}%` }}
              />
            ))}
            <div
              onPointerDown={(e) => { e.stopPropagation(); onDown(e, true); }}
              onPointerMove={onMove}
              onPointerUp={onUp}
              className={`absolute top-0 h-full cursor-grab rounded-[53px] bg-white/[0.47] mix-blend-plus-lighter will-change-[left] active:cursor-grabbing ${dragging ? "" : "transition-[left] duration-500"}`}
              style={{ width: `${(THUMB / TRACK) * 100}%`, left: `${((max ? pos / max : 0) * (TRACK - THUMB) / TRACK) * 100}%` }}
            />
          </div>
          <button
            onClick={remove}
            disabled={album.photos.length <= 1}
            className={`absolute top-1/2 left-full ml-3 flex aspect-square h-full max-h-[73px] min-h-11 -translate-y-1/2 items-center justify-center rounded-full transition hover:!bg-red-500/85 hover:!text-white active:scale-95 disabled:pointer-events-none disabled:opacity-30 sm:ml-4 ${glass}`}
            aria-label="Delete current photo"
            title="Delete current photo"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
            </svg>
          </button>
        </div>
        <p className="mt-4 text-center text-xs tracking-wide opacity-60">
          Drag the slider across albums · click a photo · drop images anywhere to add them
        </p>
      </div>

      {dropHover && (
        <div className="pointer-events-none absolute inset-4 z-[200] flex items-center justify-center rounded-[40px] border-2 border-dashed border-current/50 bg-white/15">
          <p className="text-lg font-medium">Drop to add to {album.name}</p>
        </div>
      )}

      {full && (
        <button
          onClick={() => setFull(false)}
          className="fixed inset-0 z-[300] flex animate-[fade_.3s_ease] cursor-zoom-out flex-col items-center justify-center gap-4 bg-white/90 p-6 dark:bg-black/90"
          aria-label="Close full screen"
        >
          <img
            src={photo.src}
            alt={photo.caption ?? ""}
            className="max-h-[88vh] max-w-full animate-[zoom_.4s_cubic-bezier(.2,.8,.2,1)] rounded-[30px] object-contain shadow-2xl"
          />
          {photo.caption && <p className="text-sm italic opacity-80">{photo.caption}</p>}
        </button>
      )}
    </div>
  );
}
