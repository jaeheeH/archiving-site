"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type TokenResponse = {
  success?: boolean;
  token?: string;
  expiresAt?: string;
  siteUrl?: string;
  user?: {
    email?: string;
    nickname?: string;
    role?: string;
  };
  error?: string;
};

type ConnectState = "loading" | "connected" | "unauthorized" | "forbidden" | "error";

export default function ExtensionConnectClient() {
  const [state, setState] = useState<ConnectState>("loading");
  const [message, setMessage] = useState("확장자 연결을 준비하고 있습니다.");
  const [tokenData, setTokenData] = useState<TokenResponse | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    const connect = async () => {
      try {
        const response = await fetch("/api/extension/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        const data = (await response.json()) as TokenResponse;

        if (cancelled) return;

        if (response.status === 401) {
          setState("unauthorized");
          setMessage("로그인이 필요합니다.");
          return;
        }

        if (response.status === 403) {
          setState("forbidden");
          setMessage("레퍼런스 관리 권한이 있는 계정만 확장자를 연결할 수 있습니다.");
          return;
        }

        if (!response.ok || !data.token) {
          throw new Error(data.error || "확장자 연결에 실패했습니다.");
        }

        setTokenData(data);
        setState("connected");
        setMessage("확장자가 연결되었습니다. 이제 브라우저에서 레퍼런스를 바로 저장할 수 있어요.");

        const payload = {
          source: "archb-extension-connect",
          token: data.token,
          expiresAt: data.expiresAt,
          siteUrl: data.siteUrl || window.location.origin,
          user: data.user,
        };

        let attempts = 0;
        interval = setInterval(() => {
          attempts += 1;
          window.postMessage(payload, window.location.origin);

          if (attempts >= 10 && interval) {
            clearInterval(interval);
          }
        }, 300);
      } catch (error) {
        if (cancelled) return;

        setState("error");
        setMessage(error instanceof Error ? error.message : "확장자 연결에 실패했습니다.");
      }
    };

    connect();

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, []);

  const copyToken = async () => {
    if (!tokenData?.token) return;

    await navigator.clipboard.writeText(tokenData.token);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  return (
    <main className="min-h-screen bg-white px-5 py-20 text-gray-950">
      <section className="mx-auto max-w-xl border border-gray-200 p-8">
        <p className="archive-eyebrow text-[#ff4800]">Chrome Extension</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">ARCH-B 확장자 연결</h1>
        <p className="mt-4 text-sm leading-6 text-gray-500">{message}</p>

        <div className="mt-8 border-y border-gray-200 py-5">
          <StatusRow label="상태" value={stateLabel(state)} />
          {tokenData?.user && (
            <>
              <StatusRow label="계정" value={tokenData.user.nickname || tokenData.user.email || "ARCH-B"} />
              <StatusRow label="권한" value={tokenData.user.role || "-"} />
            </>
          )}
          {tokenData?.expiresAt && (
            <StatusRow label="만료" value={new Date(tokenData.expiresAt).toLocaleDateString("ko-KR")} />
          )}
        </div>

        <div className="mt-8 flex flex-wrap gap-2">
          {state === "unauthorized" && (
            <Link
              href="/login?redirect=/extension/connect"
              className="inline-flex h-10 items-center justify-center bg-gray-950 px-4 text-sm font-semibold text-white transition hover:bg-[#ff4800]"
            >
              로그인하기
            </Link>
          )}
          {state === "connected" && (
            <button
              type="button"
              onClick={copyToken}
              className="inline-flex h-10 items-center justify-center border border-gray-950 px-4 text-sm font-semibold transition hover:border-[#ff4800] hover:text-[#ff4800]"
            >
              {copied ? "복사됨" : "토큰 수동 복사"}
            </button>
          )}
          <Link
            href="/references"
            className="inline-flex h-10 items-center justify-center border border-gray-200 px-4 text-sm font-semibold text-gray-600 transition hover:border-[#ff4800] hover:text-[#ff4800]"
          >
            레퍼런스 보기
          </Link>
        </div>

        <p className="mt-6 text-xs leading-5 text-gray-400">
          확장자가 설치되어 있다면 이 페이지를 여는 것만으로 자동 연결됩니다. 자동 연결이 안 되면 토큰을
          수동 복사한 뒤 확장자 팝업에 붙여넣어 주세요.
        </p>
      </section>
    </main>
  );
}

function stateLabel(state: ConnectState) {
  if (state === "loading") return "연결 준비 중";
  if (state === "connected") return "연결 완료";
  if (state === "unauthorized") return "로그인 필요";
  if (state === "forbidden") return "권한 없음";
  return "연결 실패";
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[88px_1fr] gap-3 py-2 text-sm">
      <span className="font-semibold text-gray-400">{label}</span>
      <span className="min-w-0 break-all font-medium text-gray-900">{value}</span>
    </div>
  );
}
