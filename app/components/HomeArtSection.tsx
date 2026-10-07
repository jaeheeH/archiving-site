import Link from "next/link";
import Image from "next/image";
import ArtworkCard from "@/app/art/ArtworkCard";
import { getArtCatalog, getArtworkArtist } from "@/lib/art-catalog";

export default async function HomeArtSection() {
  const { artists, artworks } = await getArtCatalog();
  const featured = artworks.find((artwork) => artwork.id === "cma-136510") || artworks[0];
  if (!featured) return null;
  const rest = artworks.filter((artwork) => artwork.id !== featured.id);
  const artist = await getArtworkArtist(featured);
  const museumCount = new Set(artworks.map((artwork) => artwork.museum)).size;

  return (
    <section aria-labelledby="home-art-title">
      <div className="mx-auto max-w-[1280px] px-4 pb-20 pt-5 md:px-6 md:pb-28">
        <Link
          href={`/art/${featured.id}`}
          className="group relative flex min-h-[520px] overflow-hidden rounded-[18px] bg-[#191918] md:min-h-[620px]"
        >
          <Image
            unoptimized
            src={featured.preview_url}
            alt={`${featured.title_ko} — ${artist?.name_ko || featured.artist}`}
            fill
            priority
            sizes="(max-width: 1280px) 100vw, 1280px"
            className="object-cover transition-transform duration-700 group-hover:scale-[1.015]"
          />
          <span className="absolute inset-0 bg-gradient-to-b from-black/15 via-black/25 to-black/70" />
          <span className="relative z-10 flex w-full flex-col items-center justify-center px-6 py-14 text-center text-white">
            <span className="rounded-full border border-white/45 bg-black/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] backdrop-blur-sm">
              오늘의 작품
            </span>
            <strong className="mt-6 max-w-3xl text-4xl font-bold leading-tight tracking-[-0.045em] drop-shadow-sm md:text-6xl">
              {featured.title_ko}
            </strong>
            <span className="mt-4 text-sm font-medium text-white/85 md:text-base">
              {artist?.name_ko || "작가 미상"} · {featured.date}
            </span>
            <span className="absolute bottom-7 left-7 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-white/70 md:bottom-9 md:left-10">
              {featured.museum}
            </span>
            <span className="absolute bottom-7 right-7 text-xs font-semibold tabular-nums text-white/80 md:bottom-9 md:right-10">
              01 / {String(artworks.length).padStart(2, "0")}
            </span>
          </span>
        </Link>

        <div className="mt-20 grid gap-8 border-b border-[#dfdfdb] pb-14 md:grid-cols-[1fr_.7fr] md:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#777773]">ARCH.B Art Archive</p>
            <h1 className="mt-4 max-w-3xl text-3xl font-bold leading-tight tracking-[-0.045em] md:text-5xl">
              좋아하는 작품과 발견을<br className="hidden sm:block" /> 오래 남깁니다.
            </h1>
          </div>
          <div>
            <p className="max-w-xl text-sm leading-7 text-[#6d6d68] md:text-[15px]">
              실제 작품과 작가를 중심으로 정확한 출처를 보존하고, 더 깊이 볼 수 있는 사이트와 이야기를 함께 엮습니다.
            </p>
            <Link href="/art" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold hover:underline">
              작품 전체 둘러보기 <i className="ri-arrow-right-line" aria-hidden="true" />
            </Link>
          </div>
        </div>

        <div className="mb-8 mt-20 flex items-end justify-between gap-6">
          <div>
            <h2 id="home-art-title" className="text-2xl font-bold tracking-[-0.03em] md:text-3xl">작품에서 시작하는 발견</h2>
            <p className="mt-2 text-sm leading-6 text-[#85857f]">한 작품을 천천히 보고, 같은 작가와 소장처로 이어가 보세요.</p>
          </div>
          <Link href="/art" aria-label="전체 작품 보기" className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[#d9d9d5] transition hover:bg-black hover:text-white">
            <i className="ri-arrow-right-line" aria-hidden="true" />
          </Link>
        </div>

        <div className="grid items-start gap-7 sm:grid-cols-2 lg:grid-cols-3">
          {rest.slice(0, 3).map((artwork) => <ArtworkCard key={artwork.id} artwork={artwork} />)}
        </div>
      </div>

      <div className="bg-[#11110f] text-white">
        <div className="mx-auto grid max-w-[1280px] border-x border-white/20 md:grid-cols-[1.3fr_repeat(3,.75fr)]">
          <div className="flex min-h-44 flex-col justify-between border-b border-white/20 p-6 md:min-h-56 md:border-b-0 md:border-r md:p-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">Archive index / 2026</p>
            <p className="max-w-sm text-2xl font-semibold leading-tight tracking-[-0.035em] md:text-3xl">
              작품과 맥락을 연결하는<br />살아 있는 아카이브
            </p>
          </div>
          {[
            ["작품", artworks.length],
            ["작가", artists.length],
            ["소장처", museumCount],
          ].map(([label, value], index) => (
            <div key={label} className="flex min-h-36 flex-col justify-between border-b border-white/20 p-6 last:border-b-0 md:min-h-56 md:border-b-0 md:border-r md:last:border-r-0 md:p-8">
              <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55">
                <span>{String(index + 1).padStart(2, "0")}</span>
                <span>{label}</span>
              </div>
              <strong className="text-6xl font-medium leading-none tracking-[-0.06em] tabular-nums md:text-7xl">{value}</strong>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
