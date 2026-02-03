import React from "react";

export const metadata = {
  title: "Privacy Policy | ARCH-B",
  description: "ARCH-B의 개인정보 처리방침입니다.",
};

export default function PrivacyPage() {
  const currentDate = new Date().toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <main className="w-full min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-4 py-20 md:py-28">
        {/* 헤더 섹션 */}
        <div className="mb-12 border-b border-gray-100 pb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            개인정보 처리방침
          </h1>
          <p className="text-gray-500">
            ARCH-B(이하 '서비스')는 사용자의 개인정보를 소중히 다루며, 관련 법령을 준수합니다.
          </p>
        </div>

        {/* 본문 섹션 */}
        <div className="space-y-10 text-gray-700 leading-relaxed text-sm md:text-base">
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">1. 개인정보의 수집 및 이용 목적</h2>
            <p className="mb-2">
              서비스는 다음의 목적을 위하여 개인정보를 처리합니다. 처리하고 있는 개인정보는 다음의 목적 이외의 용도로는 이용되지 않으며, 이용 목적이 변경되는 경우에는 별도의 동의를 받는 등 필요한 조치를 이행할 예정입니다.
            </p>
            <ul className="list-disc pl-5 space-y-1 text-gray-600">
              <li>서비스 제공 및 콘텐츠 큐레이션</li>
              <li>회원 관리 및 본인 확인 (로그인 시)</li>
              <li>문의 사항 처리 및 공지사항 전달</li>
              <li>서비스 이용 기록 분석 및 서비스 개선</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">2. 수집하는 개인정보의 항목</h2>
            <p className="mb-2">서비스는 회원가입, 상담, 서비스 신청 등을 위해 아래와 같은 개인정보를 수집하고 있습니다.</p>
            <div className="bg-gray-50 p-5 rounded-lg border border-gray-100">
              <ul className="list-disc pl-5 space-y-2 text-gray-600">
                <li><strong>필수항목:</strong> 이메일 주소, 이름(또는 닉네임), 비밀번호(암호화 저장)</li>
                <li><strong>자동 수집 항목:</strong> IP 주소, 쿠키, 서비스 이용 기록, 방문 기록, 기기 정보</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">3. 개인정보의 보유 및 이용 기간</h2>
            <p>
              서비스는 법령에 따른 개인정보 보유·이용기간 또는 정보주체로부터 개인정보를 수집 시에 동의받은 개인정보 보유·이용기간 내에서 개인정보를 처리·보유합니다.
            </p>
            <p className="mt-2 text-gray-600">
              - 회원 탈퇴 시 지체 없이 파기합니다.<br />
              - 단, 관계 법령 위반에 따른 수사·조사 등이 진행 중인 경우에는 해당 수사·조사 종료 시까지 보유할 수 있습니다.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">4. 사용자의 권리</h2>
            <p>
              사용자는 언제든지 자신의 개인정보를 조회하거나 수정할 수 있으며, 수집 및 이용에 대한 동의 철회 또는 가입 해지를 요청할 수 있습니다.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">5. 개인정보에 관한 민원서비스</h2>
            <p className="mb-4">
              서비스는 고객의 개인정보를 보호하고 개인정보와 관련한 불만을 처리하기 위하여 아래와 같이 관련 부서를 지정하여 운영하고 있습니다.
            </p>
            <div className="bg-gray-900 text-white p-6 rounded-lg">
              <p className="mb-2"><strong>담당 부서:</strong> ARCH-B 운영팀</p>
              <p><strong>이메일:</strong> archbehind@gmail.com</p>
            </div>
          </section>

          <section className="pt-8 border-t border-gray-100">
            <p className="text-gray-500 text-sm">
              이 개인정보 처리방침은 {currentDate}부터 적용됩니다.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}