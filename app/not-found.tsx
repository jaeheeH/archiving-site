import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-white text-gray-950 dark:bg-[#0f0f0f] dark:text-white">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-4 py-24">
        <div className="border-y border-gray-200 py-16 dark:border-gray-800 md:py-24">
          <p className="mb-5 text-sm font-bold uppercase tracking-[0.22em] text-[#ff4800]">
            404
          </p>
          <h1 className="max-w-3xl text-4xl font-black leading-tight md:text-6xl">
            페이지를 찾을 수 없습니다.
          </h1>
          <p className="mt-6 max-w-xl text-sm leading-6 text-gray-500 dark:text-gray-400 md:text-base">
            주소가 바뀌었거나 삭제된 페이지일 수 있습니다. 갤러리, 블로그, 레퍼런스에서 다시 탐색해 주세요.
          </p>

          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              href="/"
              className="inline-flex h-11 items-center justify-center bg-gray-950 px-5 text-sm font-bold text-white transition hover:bg-[#ff4800] dark:bg-white dark:text-gray-950 dark:hover:bg-[#ff4800] dark:hover:text-white"
            >
              홈으로 이동
            </Link>
            <Link
              href="/gallery"
              className="inline-flex h-11 items-center justify-center border border-gray-300 px-5 text-sm font-bold text-gray-950 transition hover:border-[#ff4800] hover:text-[#ff4800] dark:border-gray-700 dark:text-white"
            >
              갤러리 보기
            </Link>
            <Link
              href="/blog"
              className="inline-flex h-11 items-center justify-center border border-gray-300 px-5 text-sm font-bold text-gray-950 transition hover:border-[#ff4800] hover:text-[#ff4800] dark:border-gray-700 dark:text-white"
            >
              블로그 보기
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
