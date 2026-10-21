import Link from 'next/link';
import Image from 'next/image';
import { SITE_COPY } from '@/lib/site-copy';
import { getPageMetadata } from '@/lib/site-settings';
import hero from '../../public/about/archive-workspace-hero.webp';
import newsPreview from '../../public/about/news-editorial.webp';
import artPreview from '../../public/about/art-editorial.webp';
import referencesPreview from '../../public/about/references-editorial.webp';
import styles from './page.module.css';

export async function generateMetadata() {
  return getPageMetadata({
    path: '/about',
    title: 'ABOUT',
    description: `${SITE_COPY.brand.statement} ${SITE_COPY.brand.description} ARCH.B의 콘텐츠와 편집 원칙을 소개합니다.`,
  });
}

export default function AboutPage() {
  return (
    <main className={`archb-archive ${styles.page}`}>
      <header className={styles.intro}>
        <h1>ABOUT ARCH.B</h1>
        <ul className={styles.details} aria-label="ARCH.B의 관심사">
          <li>디자인 · 기술 · 공간</li>
          <li>뉴스와 에디토리얼</li>
          <li>작품 · 작가 · 참고사이트</li>
        </ul>
        <div className={styles.overview}>
          <p className="archive-kicker">{SITE_COPY.brand.tagline}</p>
          <div>
            <h2>{SITE_COPY.brand.statement}</h2>
            <p>{SITE_COPY.brand.description}</p>
            <p>빠르게 지나가는 소식에도 오래 들여다볼 이야기가 있습니다. ARCH.B는 지금 일어나는 변화와 그 배경을 읽고, 다음 생각으로 이어질 작품과 자료를 함께 모읍니다.</p>
          </div>
        </div>
      </header>

      <div className={styles.visual}>
        <Image src={hero} alt="" loading="eager" fetchPriority="high" sizes="(max-width: 760px) calc(100vw - 40px), (max-width: 1280px) calc(100vw - 48px), 1232px" />
      </div>

      <section className={styles.section} aria-labelledby="about-principles">
        <div className={styles.sectionHeading}>
          <p className="archive-kicker">OUR APPROACH</p>
          <h2 id="about-principles">기록을 대하는 태도</h2>
        </div>
        <dl className={styles.principles}>
          <div>
            <dt><span aria-hidden="true">01</span>출처에서 출발합니다.</dt>
            <dd>기사의 원문과 참고자료, 작품의 소장처와 이미지 이용 근거를 함께 기록합니다. 독자가 직접 맥락을 확인할 수 있도록 원출처로 연결합니다.</dd>
          </div>
          <div>
            <dt><span aria-hidden="true">02</span>사실과 해석을 구분합니다.</dt>
            <dd>확인된 정보와 ARCH.B의 분석을 구분해 전합니다. AI를 자료 조사와 초안 작성에 활용하며, 발행 전에는 출처와 본문을 검토합니다.</dd>
          </div>
          <div>
            <dt><span aria-hidden="true">03</span>다시 찾을 수 있게 남깁니다.</dt>
            <dd>소식과 작품, 작가, 사이트를 각각의 기록으로 쌓습니다. 관심 있는 주제를 따라 탐색하고 마음에 든 콘텐츠를 저장해 다시 꺼내 볼 수 있습니다.</dd>
          </div>
        </dl>
      </section>

      <section className={styles.section} aria-labelledby="about-content">
        <div className={styles.sectionHeading}>
          <p className="archive-kicker">EXPLORE THE ARCHIVE</p>
          <h2 id="about-content">이곳에서 만나는 것들</h2>
        </div>
        <div className={styles.content}>
          <article>
            <span className={styles.contentNumber} aria-hidden="true">01</span>
            <div className={styles.contentPreview}>
              <p>READ</p>
              <Image src={newsPreview} alt="신문과 잡지로 표현한 읽을거리" sizes="(max-width: 760px) calc(100vw - 84px), (max-width: 1280px) calc(39.13vw - 72px), 429px" />
            </div>
            <div className={styles.contentBody}>
              <h3>뉴스와 에디토리얼</h3>
              <p>디자인·AI·제품·개발·인테리어의 소식을 전합니다. 무엇이 달라졌는지 살피고, 변화의 배경과 의미를 함께 읽습니다.</p>
              <Link prefetch={false} href="/news/stories">뉴스 읽기 <span aria-hidden="true">↗</span></Link>
            </div>
          </article>
          <article>
            <span className={styles.contentNumber} aria-hidden="true">02</span>
            <div className={styles.contentPreview}>
              <p>EXPLORE</p>
              <Image src={artPreview} alt="추상 조형물과 회화" sizes="(max-width: 760px) calc(100vw - 84px), (max-width: 1280px) calc(39.13vw - 72px), 429px" />
            </div>
            <div className={styles.contentBody}>
              <h3>작품과 작가</h3>
              <p>작품 한 점에서 작가의 다른 작업으로 시선을 넓힙니다. 작품 정보와 소장처, 원출처를 따라 더 깊이 감상할 수 있습니다.</p>
              <div className={styles.links}>
                <Link prefetch={false} href="/art">작품 보기 <span aria-hidden="true">↗</span></Link>
                <Link prefetch={false} href="/artists">작가 만나기 <span aria-hidden="true">↗</span></Link>
              </div>
            </div>
          </article>
          <article>
            <span className={styles.contentNumber} aria-hidden="true">03</span>
            <div className={styles.contentPreview}>
              <p>DISCOVER</p>
              <Image src={referencesPreview} alt="시각 자료를 분류한 인덱스 카드" sizes="(max-width: 760px) calc(100vw - 84px), (max-width: 1280px) calc(39.13vw - 72px), 429px" />
            </div>
            <div className={styles.contentBody}>
              <h3>참고사이트</h3>
              <p>작업과 탐색의 출발점이 될 웹사이트를 모읍니다. 새로운 관점이 필요할 때, 소개와 분류를 따라 다음 방문지를 찾아보세요.</p>
              <Link prefetch={false} href="/references">참고사이트 둘러보기 <span aria-hidden="true">↗</span></Link>
            </div>
          </article>
        </div>
      </section>

      <section className={`${styles.section} ${styles.contact}`} aria-labelledby="about-contact">
        <div>
          <p className="archive-kicker">GET IN TOUCH</p>
          <h2 id="about-contact">다음 이야기를 들려주세요.</h2>
          <p>소개하고 싶은 소식이나 사이트, 콘텐츠 정정과 협업 제안을 기다립니다.</p>
        </div>
        <a href="mailto:archbehind@gmail.com">archbehind@gmail.com <span aria-hidden="true">↗</span></a>
      </section>
    </main>
  );
}
