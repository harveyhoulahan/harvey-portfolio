"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import type { CaseImage } from "@/data/projects";

export default function CaseGallery({ images }: { images: CaseImage[] }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [lightbox, setLightbox] = useState<number | null>(null);

  const scrollBy = useCallback((dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.8;
    el.scrollBy({ left: dir * amount, behavior: "smooth" });
  }, []);

  // Lightbox keyboard controls.
  useEffect(() => {
    if (lightbox === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
      if (e.key === "ArrowRight")
        setLightbox((i) => (i === null ? i : (i + 1) % images.length));
      if (e.key === "ArrowLeft")
        setLightbox((i) =>
          i === null ? i : (i - 1 + images.length) % images.length
        );
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox, images.length]);

  if (!images?.length) return null;

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between">
        <span className="mono-label text-ink/60">Inside the platform</span>
        {images.length > 1 && (
          <div className="hidden gap-2 md:flex">
            <button
              type="button"
              onClick={() => scrollBy(-1)}
              aria-label="Previous image"
              className="flex h-8 w-8 items-center justify-center border border-contour text-ink/60 transition-colors hover:border-flow hover:text-flow"
            >
              <ArrowLeft size={15} />
            </button>
            <button
              type="button"
              onClick={() => scrollBy(1)}
              aria-label="Next image"
              className="flex h-8 w-8 items-center justify-center border border-contour text-ink/60 transition-colors hover:border-flow hover:text-flow"
            >
              <ArrowRight size={15} />
            </button>
          </div>
        )}
      </div>

      <div
        ref={scrollerRef}
        className="mt-4 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {images.map((img, i) => (
          <figure
            key={img.src}
            className="w-[85%] shrink-0 snap-start sm:w-[70%] md:w-[58%] lg:w-[48%]"
          >
            <button
              type="button"
              onClick={() => setLightbox(i)}
              className="group relative block aspect-[16/10] w-full overflow-hidden rounded-sm border border-contour bg-terrace"
              aria-label={`Expand image: ${img.caption ?? img.alt}`}
            >
              <Image
                src={img.src}
                alt={img.alt}
                fill
                sizes="(max-width: 768px) 85vw, 50vw"
                className="object-contain transition-transform duration-500 group-hover:scale-[1.03]"
              />
            </button>
            {img.caption && (
              <figcaption className="mt-2 font-mono text-xs text-ink/50">
                {img.caption}
              </figcaption>
            )}
          </figure>
        ))}
      </div>

      {lightbox !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/85 p-4 backdrop-blur-sm"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            aria-label="Close"
            className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center border border-white/30 text-white/80 transition-colors hover:border-white hover:text-white"
          >
            <X size={18} />
          </button>
          <figure
            className="relative max-h-[85vh] w-full max-w-5xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative aspect-[16/10] w-full overflow-hidden rounded-sm">
              <Image
                src={images[lightbox].src}
                alt={images[lightbox].alt}
                fill
                sizes="90vw"
                className="object-contain"
                priority
              />
            </div>
            {images[lightbox].caption && (
              <figcaption className="mt-3 text-center font-mono text-xs uppercase tracking-[0.12em] text-white/70">
                {images[lightbox].caption}
              </figcaption>
            )}
          </figure>
        </div>
      )}
    </div>
  );
}
