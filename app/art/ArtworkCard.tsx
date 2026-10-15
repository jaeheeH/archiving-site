import { SaveButton } from '@/app/components/SavedProvider';
import Link from "next/link";
import Image from "@/app/components/ArchiveImage";
import type { CSSProperties } from "react";
import { getArtworkArtist, type Artwork } from "@/lib/art-catalog";
import ArtworkTags from '@/app/components/ArtworkTags';

export default async function ArtworkCard({ artwork, returnTo }: { artwork: Artwork; returnTo?: string }) {
  const artist = await getArtworkArtist(artwork);
  const href = returnTo ? `/art/${artwork.id}?${new URLSearchParams({ from: `${returnTo}#artwork-${artwork.id}` })}` : `/art/${artwork.id}`;

  return (
    <article id={`artwork-${artwork.id}`} className="archive-card archive-art-card group">
      <Link href={href} className="archive-media" style={{ "--archive-image-ratio": artwork.image_width > 0 && artwork.image_height > 0 ? `${artwork.image_width} / ${artwork.image_height}` : "1.65" } as CSSProperties}>
          <Image
            src={artwork.preview_url}
            alt={`${artwork.title_ko} — ${artist?.name_ko || artwork.artist}`}
            fill
            loading="lazy"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover"
          />
      </Link>
      <div className="archive-card-copy">
        <p className="archive-card-label">{artwork.museum}</p>
        <div className="archive-card-title-row">
          <h2><Link href={href}>{artwork.title_ko}</Link></h2>
          <SaveButton type="artwork" id={artwork.id} title={artwork.title_ko} iconOnly />
        </div>
        <p className="archive-card-description">
          {artist?.name_ko || artist?.name || "작가 미상"} · {artwork.date}
        </p>
        <ArtworkTags taxonomy={artwork.taxonomy} groups={['subject']} />
      </div>
    </article>
  );
}
