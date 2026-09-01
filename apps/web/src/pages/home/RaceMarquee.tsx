import { useEffect, useRef, useState } from 'react';

type RaceMarqueeProps = {
  text: string;
};

/** Бегущая строка с бесшовным зацикливанием */
export const RaceMarquee = ({ text }: RaceMarqueeProps) => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [copiesPerSegment, setCopiesPerSegment] = useState(2);

  useEffect(() => {
    const viewport = viewportRef.current;
    const measure = measureRef.current;
    if (!viewport || !measure) return;

    const update = () => {
      const viewportWidth = viewport.clientWidth;
      const unitWidth = measure.getBoundingClientRect().width;
      if (unitWidth <= 0) return;

      // Каждый сегмент должен быть шире viewport, чтобы не было пробела при зацикливании
      setCopiesPerSegment(Math.max(2, Math.ceil(viewportWidth / unitWidth) + 1));
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [text]);

  const segment = text.repeat(copiesPerSegment);

  return (
    <div
      ref={viewportRef}
      className="relative mt-10 overflow-hidden border-4 border-[var(--border)] bg-[var(--bg)] p-2"
    >
      <span
        ref={measureRef}
        className="sega-race-strip-content pointer-events-none absolute opacity-0"
        aria-hidden
      >
        {text}
      </span>
      <div className="sega-race-strip-track flex">
        <div className="sega-race-strip-content" aria-hidden>
          {segment}
        </div>
        <div className="sega-race-strip-content" aria-hidden>
          {segment}
        </div>
      </div>
    </div>
  );
};
