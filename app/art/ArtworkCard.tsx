import { SaveButton } from '@/app/components/SavedProvider';
import Link from "next/link";
import Image from "@/app/components/ArchiveImage";
import type { CSSProperties } from "react";
import { getArtworkArtist, type Artwork } from "@/lib/art-catalog";
import ArtworkTags from '@/app/components/ArtworkTags';

export default async function ArtworkCard({ artwork, returnTo, sizes = '(max-width: 640px) calc(100vw - 40px), (max-width: 950px) 50vw, (max-width: 1280px) 33vw, 394px' }: { artwork: Artwork; returnTo?: string; sizes?: string }) {
  const artist = await getArtworkArtist(artwork);
  const href = returnTo ? `/art/${artwork.id}?${new URLSearchParams({ from: `${returnTo}#artwork-${artwork.id}` })}` : `/art/${artwork.id}`;

  return (
    <article id={`artwork-${artwork.id}`} className="archive-card archive-art-card group" data-analytics-resource={`artwork:${artwork.id}`} data-analytics-path={`/art/${artwork.id}`}>
      <Link prefetch={false} href={href} className="archive-media" style={{ "--archive-image-ratio": artwork.image_width > 0 && artwork.image_height > 0 ? `${artwork.image_width} / ${artwork.image_height}` : "1.65" } as CSSProperties}>
          <Image
            src={artwork.preview_url}
            alt={`${artwork.title_ko} — ${artist?.name_ko || artwork.artist}`}
            fill
            loading="lazy"
            sizes={sizes}
            className="object-cover"
          />
      </Link>
      <div className="archive-card-copy">
        <p className="archive-card-label">{artwork.museum}</p>
        <div className="archive-card-title-row">
          <h2><Link prefetch={false} href={href}>{artwork.title_ko}</Link></h2>
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
