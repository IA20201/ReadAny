/**
 * BookCoverHero — Book cover with depth, shadow, spine effect
 * Matching BookCard visual quality with larger presentation
 */
import { useResolvedSrc } from "@/hooks/use-resolved-src";
import type { Book } from "@readany/core/types";
import { useState } from "react";

interface BookCoverHeroProps {
  book: Book;
  size?: "small" | "large";
}

export function BookCoverHero({ book, size = "large" }: BookCoverHeroProps) {
  const coverSrc = useResolvedSrc(book.meta.coverUrl);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const dims = size === "large"
    ? { w: 180, h: 264 } // 28:41
    : { w: 120, h: 176 };

  return (
    <div className="flex justify-center">
      {/* Soft diffused shadow underneath */}
      <div className="relative" style={{ width: dims.w }}>
        <div
          className="pointer-events-none absolute -inset-2 rounded-lg opacity-[0.12]"
          style={{
            background: "radial-gradient(ellipse at 50% 80%, var(--foreground) 0%, transparent 70%)",
            filter: "blur(16px)",
          }}
        />
        {/* Main cover container */}
        <div
          className="book-cover-shadow relative overflow-hidden rounded-sm"
          style={{ width: dims.w, height: dims.h }}
        >
          {/* Cover image or fallback */}
          {coverSrc && !imageError ? (
            <img
              src={coverSrc}
              alt={book.meta.title}
              className="h-full w-full object-cover transition-opacity duration-500"
              style={{ opacity: imageLoaded ? 1 : 0 }}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
              loading="lazy"
            />
          ) : (
            <FallbackCover title={book.meta.title} author={book.meta.author} />
          )}

          {/* Spine overlay for book realism */}
          <div className="book-spine pointer-events-none absolute inset-0" />

          {/* Top highlight reflection */}
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-1/3"
            style={{
              background: "linear-gradient(to bottom, rgba(255,255,255,0.08), transparent)",
            }}
          />
        </div>
      </div>
    </div>
  );
}

function FallbackCover({ title, author }: { title: string; author: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-muted via-muted/80 to-muted/60 p-5">
      {/* Decorative line */}
      <div className="mb-3 h-px w-12 bg-foreground/15" />
      <span className="line-clamp-3 text-center font-serif text-sm font-semibold leading-snug text-foreground/80">
        {title}
      </span>
      {author && (
        <>
          <div className="my-2 h-px w-8 bg-foreground/10" />
          <span className="line-clamp-1 text-center text-[10px] tracking-wide text-muted-foreground/70 uppercase">
            {author}
          </span>
        </>
      )}
      {/* Decorative line */}
      <div className="mt-3 h-px w-12 bg-foreground/15" />
    </div>
  );
}
