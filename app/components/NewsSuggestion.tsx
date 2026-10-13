'use client';

import { useRef, useState } from 'react';

const email = 'archbehind@gmail.com';

export default function NewsSuggestion() {
  const address = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');
  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(email);
      setMessage('메일 주소를 복사했습니다.');
    } catch {
      address.current?.focus();
      address.current?.select();
      setMessage('선택된 주소를 직접 복사해 주세요.');
    }
  };

  return <div className="news-suggestion">
    <p className="news-source-note">소개하고 싶은 소식이나 참고사이트, 개선 의견이 있다면 알려주세요.</p>
    <details>
      <summary><span>제안 보내기</span><i className="ri-arrow-down-s-line" aria-hidden="true" /></summary>
      <div className="news-suggestion-options">
        <a href={`mailto:${email}?subject=${encodeURIComponent('ARCH.B 제안')}`}><span>메일 앱 열기</span><small aria-hidden="true">↗</small></a>
        <div className="news-suggestion-address">
          <input ref={address} aria-label="제안 받을 메일 주소" readOnly value={email} onFocus={event => event.currentTarget.select()} />
          <button type="button" onClick={copyAddress}>주소 복사</button>
        </div>
        <p className="news-source-note">메일 앱이 열리지 않으면 주소를 복사해 사용하시는 메일에서 보내주세요.</p>
        <p className="news-source-note" role="status">{message}</p>
      </div>
    </details>
  </div>;
}
