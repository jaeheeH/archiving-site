import Link from "next/link";
import { ShieldAlert } from "lucide-react";

export default function NoAccessPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-6">
      <section className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md bg-gray-100 text-gray-700">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h1 className="mt-6 text-xl font-semibold text-gray-950">접근 권한이 없습니다</h1>
        <p className="mt-3 text-sm leading-6 text-gray-500">
          현재 계정으로는 요청한 대시보드 영역에 접근할 수 없습니다.
          필요한 권한이 있다면 관리자에게 역할 변경을 요청해주세요.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Link
            href="/"
            className="inline-flex h-9 items-center rounded-md border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            사이트로 이동
          </Link>
          <Link
            href="/login"
            className="inline-flex h-9 items-center rounded-md bg-gray-900 px-4 text-sm font-medium text-white hover:bg-gray-800"
          >
            다른 계정으로 로그인
          </Link>
        </div>
      </section>
    </main>
  );
}
