'use client';

import { Children, cloneElement, isValidElement, useEffect, useRef, useState, type AnchorHTMLAttributes, type PointerEvent, type ReactNode } from 'react';

export default function DiscoveryFlow({ children, id, label, direction }: { children: ReactNode; id: string; label: string; direction: 'vertical' | 'horizontal' }) {
  const [paused, setPaused] = useState(true);
  const [visible, setVisible] = useState(false);
  const [dragging, setDragging] = useState(false);
  const flowRef = useRef<HTMLDivElement>(null);
  const suppressClick = useRef(false);
  const drag = useRef<{ pointerId: number; x: number; time: number; duration: number; distance: number; sign: number; scroll: number; animation?: Animation; moved: boolean } | null>(null);

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncMotion = () => setPaused(motion.matches);
    let intersecting = false;
    const syncVisibility = () => setVisible(intersecting && !document.hidden);
    const observer = new IntersectionObserver(([entry]) => {
      intersecting = entry.isIntersecting;
      syncVisibility();
    });
    if (flowRef.current) observer.observe(flowRef.current);
    syncMotion();
    motion.addEventListener('change', syncMotion);
    document.addEventListener('visibilitychange', syncVisibility);
    return () => {
      motion.removeEventListener('change', syncMotion);
      document.removeEventListener('visibilitychange', syncVisibility);
      observer.disconnect();
    };
  }, []);

  const items = Children.toArray(children).filter(isValidElement<AnchorHTMLAttributes<HTMLAnchorElement>>);
  const lanes = direction === 'horizontal' ? [items] : [items.filter((_, index) => index % 2 === 0), items.filter((_, index) => index % 2 === 1)];

  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || event.button !== 0) return;
    const track = event.currentTarget.querySelector<HTMLElement>('.news-flow-track');
    if (!track || getComputedStyle(track).flexDirection !== 'row') return;
    const animation = track.getAnimations()[0];
    const duration = animation?.effect?.getComputedTiming().duration;
    drag.current = { pointerId: event.pointerId, x: event.clientX, time: typeof animation?.currentTime === 'number' ? animation.currentTime : 0, duration: typeof duration === 'number' ? duration : 0, distance: track.scrollWidth / 2, sign: getComputedStyle(track).animationDirection === 'reverse' ? -1 : 1, scroll: event.currentTarget.scrollLeft, animation, moved: false };
    suppressClick.current = false;
    setDragging(true);
  };
  const moveDrag = (event: PointerEvent<HTMLDivElement>) => {
    const active = drag.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const delta = event.clientX - active.x;
    if (!active.moved && Math.abs(delta) < 6) return;
    active.moved = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    if (active.animation && active.duration && active.distance) {
      const time = active.time - delta / active.distance * active.duration * active.sign;
      active.animation.currentTime = ((time % active.duration) + active.duration) % active.duration;
    } else {
      event.currentTarget.scrollLeft = active.scroll - delta;
    }
  };
  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    suppressClick.current = drag.current.moved;
    drag.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return <div ref={flowRef} className={`news-discovery-flow news-flow-${direction}`} data-paused={paused || !visible || dragging} data-dragging={dragging || undefined} onClickCapture={event => {
    if (event.detail && suppressClick.current) {
      event.preventDefault();
      event.stopPropagation();
      suppressClick.current = false;
    }
  }}>
    <p id={`${id}-help`} className="sr-only">스페이스 키로 자동 흐름을 멈추거나 다시 재생할 수 있습니다. 링크에 포커스하면 움직임이 멈춥니다.</p>
    <div id={id} className="news-flow-window" role="region" aria-label={label} aria-describedby={`${id}-help`} aria-keyshortcuts="Space" tabIndex={0} onKeyDown={event => {
      if (event.target === event.currentTarget && event.key === ' ') {
        event.preventDefault();
        setPaused(value => !value);
      }
    }}>
      {lanes.map((items, lane) => <div className="news-flow-lane" key={lane} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={endDrag} onDragStart={event => event.preventDefault()} onFocusCapture={event => {
        if (event.target.matches('a:focus-visible')) event.target.querySelector('h3')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }} onBlurCapture={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          event.currentTarget.scrollTop = 0;
          event.currentTarget.scrollLeft = 0;
        }
      }}>
        <ul className="news-flow-track">
          {[false, true].map(repeat => items.map(child => <li key={`${repeat}-${child.key}`} data-flow-copy={repeat ? 'repeat' : 'original'} aria-hidden={repeat || undefined}>
            {repeat ? cloneElement(child, { tabIndex: -1 }) : child}
          </li>))}
        </ul>
      </div>)}
    </div>
  </div>;
}
