import Link from "next/link";

export const metadata = {
  title: "Terms of Service | ARCH-B",
  description: "ARCH-B의 이용약관입니다.",
};

const termsSections = [
  {
    title: "1. 목적",
    body: [
      "본 약관은 ARCH-B(이하 '서비스')가 제공하는 갤러리, 블로그, 레퍼런스, AI 작업공간 및 관련 기능의 이용 조건과 절차, 서비스와 이용자의 권리와 의무를 정하는 것을 목적으로 합니다.",
    ],
  },
  {
    title: "2. 서비스의 제공",
    body: [
      "서비스는 디자인 영감, 생성 이미지, 프롬프트, 블로그 콘텐츠, 외부 레퍼런스 등을 기록하고 탐색할 수 있는 기능을 제공합니다.",
      "서비스는 운영상 또는 기술상 필요한 경우 제공 기능의 일부를 변경하거나 중단할 수 있으며, 중요한 변경 사항은 서비스 내 공지 또는 별도 안내를 통해 알립니다.",
    ],
  },
  {
    title: "3. 회원 계정",
    body: [
      "이용자는 정확한 정보를 바탕으로 계정을 생성하고 관리해야 하며, 계정 정보의 관리 책임은 이용자에게 있습니다.",
      "타인의 계정을 무단으로 사용하거나 허위 정보를 입력하여 서비스 운영을 방해하는 행위는 제한될 수 있습니다.",
    ],
  },
  {
    title: "4. 콘텐츠와 권리",
    body: [
      "이용자가 서비스에 등록한 이미지, 프롬프트, 게시글, 레퍼런스 등 콘텐츠의 권리는 원칙적으로 해당 이용자 또는 정당한 권리자에게 있습니다.",
      "이용자는 자신이 업로드하거나 저장하는 콘텐츠가 제3자의 저작권, 상표권, 초상권, 개인정보 및 기타 권리를 침해하지 않도록 주의해야 합니다.",
      "서비스는 운영, 백업, 검색, 표시, 추천 등 서비스 제공에 필요한 범위에서 이용자가 등록한 콘텐츠를 처리할 수 있습니다.",
    ],
  },
  {
    title: "5. 금지 행위",
    body: [
      "이용자는 불법 정보, 타인의 권리를 침해하는 자료, 악성 코드, 과도한 트래픽을 유발하는 행위, 서비스의 정상 운영을 방해하는 행위를 해서는 안 됩니다.",
      "서비스의 취지와 무관하게 자동화 도구를 사용하여 데이터를 대량 수집하거나 시스템을 우회하는 행위는 제한될 수 있습니다.",
    ],
  },
  {
    title: "6. AI 생성 기능",
    body: [
      "AI 생성 기능을 통해 만들어진 결과물은 입력 프롬프트, 학습 자산, 외부 모델 정책 및 생성 시점의 조건에 따라 달라질 수 있습니다.",
      "이용자는 AI 생성 결과물을 사용하기 전에 사실성, 권리 침해 여부, 상업적 사용 가능 여부를 직접 확인해야 합니다.",
    ],
  },
  {
    title: "7. 서비스 이용 제한",
    body: [
      "서비스는 약관 위반, 권리 침해 신고, 비정상적인 사용 패턴, 보안상 위험이 확인되는 경우 이용자의 콘텐츠 노출, 기능 사용 또는 계정 이용을 제한할 수 있습니다.",
    ],
  },
  {
    title: "8. 면책",
    body: [
      "서비스는 이용자가 등록하거나 외부에서 수집한 콘텐츠의 정확성, 완전성, 적법성을 보장하지 않습니다.",
      "이용자가 서비스를 통해 얻은 정보 또는 생성 결과를 활용하여 발생한 손해에 대해서는 관련 법령이 허용하는 범위 내에서 책임을 부담하지 않습니다.",
    ],
  },
  {
    title: "9. 문의",
    body: [
      "약관 및 서비스 이용과 관련한 문의는 ARCH-B 운영팀으로 연락할 수 있습니다.",
    ],
  },
];

export default function TermsPage() {
  const currentDate = new Date().toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <main className="min-h-screen w-full bg-white text-gray-900 dark:bg-[#0f0f0f] dark:text-gray-100">
      <div className="mx-auto max-w-4xl px-4 py-20 md:py-28">
        <div className="mb-12 border-b border-gray-100 pb-8 dark:border-gray-800">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-[#ff4800]">
            Policy
          </p>
          <h1 className="mb-4 text-3xl font-bold md:text-4xl">이용약관</h1>
          <p className="max-w-2xl text-sm leading-6 text-gray-500 dark:text-gray-400 md:text-base">
            ARCH-B를 이용하기 전에 서비스 이용 조건과 콘텐츠 운영 기준을 확인해 주세요.
          </p>
        </div>

        <div className="space-y-10 text-sm leading-7 text-gray-700 dark:text-gray-300 md:text-base">
          {termsSections.map((section) => (
            <section key={section.title}>
              <h2 className="mb-4 text-xl font-bold text-gray-950 dark:text-white">
                {section.title}
              </h2>
              <div className="space-y-3">
                {section.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}

          <section className="rounded-lg border border-gray-200 bg-gray-50 p-6 dark:border-gray-800 dark:bg-[#171717]">
            <h2 className="mb-3 text-base font-bold text-gray-950 dark:text-white">운영팀</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              이메일:{" "}
              <a href="mailto:archbehind@gmail.com" className="font-medium text-[#ff4800]">
                archbehind@gmail.com
              </a>
            </p>
          </section>

          <section className="border-t border-gray-100 pt-8 text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
            <p>이 이용약관은 {currentDate}부터 적용됩니다.</p>
            <Link href="/privacy" className="mt-4 inline-flex font-medium text-[#ff4800]">
              개인정보 처리방침 보기
            </Link>
          </section>
        </div>
      </div>
    </main>
  );
}
