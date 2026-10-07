import Link from "next/link";
import Image from "next/image";
import type { CSSProperties } from "react";
import { getArtworkArtist, type Artwork } from "@/lib/art-catalog";

export default async function ArtworkCard({ artwork }: { artwork: Artwork }) {
  const artist = await getArtworkArtist(artwork);

  return (
    <article className="archive-card archive-art-card group">
      <Link href={`/art/${artwork.id}`} className="block">
        <div className="archive-media" style={{ "--archive-image-ratio": artwork.image_width > 0 && artwork.image_height > 0 ? `${artwork.image_width} / ${artwork.image_height}` : "1.65" } as CSSProperties}>
          <Image
            unoptimized
            src={artwork.preview_url}
            alt={`${artwork.title_ko} — ${artist?.name_ko || artwork.artist}`}
            fill
            loading="lazy"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-contain p-4 transition-transform duration-500 group-hover:scale-[1.025]"
          />
        </div>
        <div className="archive-card-copy">
          <p className="archive-card-label">{artwork.museum}</p>
          <h2>
            {artwork.title_ko}
          </h2>
          <p className="archive-card-description">
            {artist?.name_ko || "작가 미상"} · {artwork.date}
          </p>
        </div>
      </Link>
    </article>
  );
}
