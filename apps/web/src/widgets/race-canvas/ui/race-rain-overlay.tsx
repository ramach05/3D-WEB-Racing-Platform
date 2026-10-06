import { useEffect, useRef } from 'react';
import { useRaceHud } from '@/features/race-session';

const DROP_POOL_SIZE = 120;

type TRainDrop = {
  x: number;
  y: number;
  speed: number;
  life: number;
  maxLife: number;
  size: number;
};

const drops: TRainDrop[] = [];
for (let i = 0; i < DROP_POOL_SIZE; i += 1) {
  drops.push({ x: 0, y: 0, speed: 0, life: 0, maxLife: 0, size: 0 });
}

/** DOM-оверлей с каплями на экране (только дождливые трассы, режим заезда) */
export const RaceRainOverlay = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hud = useRaceHud();
  const rafRef = useRef(0);
  const racingRef = useRef(false);

  useEffect(() => {
    racingRef.current = hud.status === 'racing';
  }, [hud.status]);

  useEffect(() => {
    if (!racingRef.current) {
      cancelAnimationFrame(rafRef.current);
      const c = canvasRef.current;
      if (c) {
        const ctx = c.getContext('2d');
        ctx?.clearRect(0, 0, c.width, c.height);
      }
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    let ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 0;
    let height = 0;
    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
      ctx = canvas.getContext('2d');
    };
    resize();
    window.addEventListener('resize', resize);

    let lastTime = performance.now();
    let spawnTimer = 0;
    const poolIndex: [number] = [0];

    const animate = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      if (!ctx || width === 0 || height === 0) {
        rafRef.current = requestAnimationFrame(animate);
        return;
      }

      ctx.clearRect(0, 0, width, height);

      // Спавн новых капель: темп зависит от скорости
      const speedFactor = Math.min(1, Math.abs(hud.speedKmh) / 40);
      spawnTimer += dt * speedFactor * 25;
      while (spawnTimer >= 1) {
        spawnTimer -= 1;
        // Найти свободную каплю
        let idx = -1;
        for (let tryN = 0; tryN < 30; tryN++) {
          const t = (poolIndex[0] + tryN) % DROP_POOL_SIZE;
          const d = drops[t];
          if (d && d.life <= 0) {
            idx = t;
            poolIndex[0] = t + 1;
            break;
          }
        }
        if (idx === -1) break;
        const d = drops[idx]!;
        d.x = width * (0.05 + Math.random() * 0.9);
        d.y = -10 - Math.random() * 30;
        d.speed = 200 + speedFactor * 300;
        d.life = 0;
        d.maxLife = 1.5 + Math.random() * 1.5;
        d.size = 1.5 + Math.random() * 2.5;
      }

      // Обновить и отрисовать
      for (const d of drops) {
        if (d.life <= 0) continue;
        d.life += dt;
        d.y += d.speed * dt;

        if (d.life >= d.maxLife || d.y > height + 20) {
          d.life = 0;
          continue;
        }

        const alpha = Math.min(1, d.life * 3) * Math.min(1, (d.maxLife - d.life) * 2) * 0.25;
        const stretch = 1 + d.life * 2;

        ctx.save();
        ctx.translate(d.x, d.y);
        ctx.scale(1, stretch);
        ctx.fillStyle = `rgba(180, 200, 220, ${alpha})`;
        ctx.beginPath();
        ctx.arc(0, 0, d.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [hud.speedKmh]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 z-[5]"
      style={{ imageRendering: 'auto' }}
    />
  );
};
