'use client';

import { useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import { setColorMode } from '@/lib/color-mode';

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  return () => observer.disconnect();
}

export default function ColorModeToggle({ className = '' }: { className?: string }) {
  const dark = useSyncExternalStore(subscribe, () => document.documentElement.classList.contains('dark'), () => false);
  return <Button type="button" variant="ghost" size="icon-lg" className={`color-mode-toggle ${className}`}
    aria-label="다크 모드" aria-pressed={dark} title={dark ? '라이트 모드로 전환' : '다크 모드로 전환'}
    onClick={() => setColorMode(dark ? 'light' : 'dark')}>
    <i className={dark ? 'ri-moon-line' : 'ri-sun-line'} aria-hidden="true" />
  </Button>;
}
