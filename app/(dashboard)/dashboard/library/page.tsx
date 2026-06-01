import Link from "next/link";
import { redirect } from "next/navigation";
import { ImageIcon, Sparkles } from "lucide-react";

import { getGeneratedImageLibrary } from "@/lib/dashboard-data";
import LibraryClient from "./LibraryClient";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const data = await getGeneratedImageLibrary();

  if (!data) {
    redirect("/login?redirect=/dashboard/library");
  }

  return (
    <div>
      <header className="dashboard-Header">
        <div>
          <h1>Library</h1>
          <p className="mt-1 text-xs text-gray-500">
            Studio에서 생성한 이미지를 확인하고 재사용합니다.
          </p>
        </div>
        <Link
          href="/dashboard/studio"
          className="inline-flex h-9 items-center gap-2 rounded-md bg-gray-900 px-3 text-sm font-medium text-white hover:bg-gray-800"
        >
          <Sparkles className="h-4 w-4" />
          이미지 생성
        </Link>
      </header>

      <main className="dashboard-container">
        {data.images.length === 0 ? (
          <section className="flex min-h-[420px] items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
            <div>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md bg-gray-100 text-gray-700">
                <ImageIcon className="h-6 w-6" />
              </div>
              <h2 className="mt-5 text-lg font-semibold text-gray-950">
                아직 생성된 이미지가 없습니다
              </h2>
              <p className="mt-2 text-sm text-gray-500">
                Studio에서 첫 이미지를 만들면 이곳에 저장됩니다.
              </p>
              <Link
                href="/dashboard/studio"
                className="mt-5 inline-flex h-9 items-center rounded-md bg-gray-900 px-4 text-sm font-medium text-white hover:bg-gray-800"
              >
                Studio 열기
              </Link>
            </div>
          </section>
        ) : (
          <LibraryClient initialImages={data.images} />
        )}
      </main>
    </div>
  );
}
