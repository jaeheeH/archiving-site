import Link from 'next/link';
export default function NewsArchiveDiscovery() {
  return <section className="news-archive-discovery" aria-labelledby="archive-discovery-title">
    <h2 id="archive-discovery-title">작가 아카이브</h2>
    <div>
      <p>작품을 더 깊이 보고 싶다면, 그 작품을 만든 사람에게로 시선을 옮겨 보세요. 작가의 생애와 활동 배경을 읽고, 서로 다른 기관에 흩어져 있는 작품을 한자리에서 이어 봅니다. 한 사람의 시선이 시간에 따라 어떻게 달라지는지, 작품 사이에 어떤 이야기가 흐르는지 천천히 살펴볼 수 있습니다.</p>
      <Link href="/artists">작가 보러가기 <i className="ri-arrow-right-up-line" aria-hidden="true" /></Link>
    </div>
  </section>;
}
