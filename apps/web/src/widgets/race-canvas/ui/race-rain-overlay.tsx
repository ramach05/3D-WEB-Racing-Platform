import { useEffect, useRef } from 'react';
import { getRaceHudSnapshot } from '@/features/race-session';

const DROP_POOL_SIZE = 420;
const GRAVITY = 620;
/** Порог радиуса, с которого капля срывается и течет, оставляя след */
const RUN_THRESHOLD = 3.4;

type TDrop = {
  x: number;
  y: number;
  r: number;
  vy: number;
  vx: number;
  /** true — капля прилипла; false — течет вниз со следом */
  stuck: boolean;
  life: number;
  maxLife: number;
  active: boolean;
};

const drops: TDrop[] = [];
for (let i = 0; i < DROP_POOL_SIZE; i += 1) {
  drops.push({ x: 0, y: 0, r: 0, vy: 0, vx: 0, stuck: true, life: 0, maxLife: 1, active: false });
}

/**
 * DOM-оверлей капель на «стекле» (дождливые трассы, вся сессия заезда:
 * готовность, отсчет, гонка, пауза). Капли прилипают и растут, срываются
 * и текут вниз со светящимся следом; темп спавна зависит от скорости.
 * Скорость читается из snapshot напрямую (tickRace пишет без React-emit).
 */
export const RaceRainOverlay = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);

  useEffect(() => {
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
    let cursor = 0;

    const animate = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      if (!ctx || width === 0 || height === 0) {
        rafRef.current = requestAnimationFrame(animate);
        return;
      }

      ctx.clearRect(0, 0, width, height);

      const speedFactor = Math.min(1, Math.abs(getRaceHudSnapshot().speedKmh) / 60);
      // В стоячем положении капли копятся (поток не сдувает); при езде напор на стекло
      // многократно выше — темп появления растет с скоростью в несколько раз
      spawnTimer += dt * (26 + speedFactor * 85);
      while (spawnTimer >= 1) {
        spawnTimer -= 1;
        let idx = -1;
        for (let tryN = 0; tryN < 40; tryN++) {
          const cand = drops[(cursor + tryN) % DROP_POOL_SIZE];
          if (cand && !cand.active) {
            idx = (cursor + tryN) % DROP_POOL_SIZE;
            cursor = idx + 1;
            break;
          }
        }
        if (idx === -1) break;
        const d = drops[idx]!;
        d.x = width * (0.02 + Math.random() * 0.96);
        d.y = Math.random() * height;
        d.r = 1.2 + Math.random() * 2.6;
        d.vy = 0;
        d.vx = 0;
        d.stuck = true;
        d.life = 0;
        d.maxLife = 2 + Math.random() * 3.5;
        d.active = true;
      }

      for (const d of drops) {
        if (!d.active) continue;
        d.life += dt;

        // Прилипшая капля подрастает (конденсат); крупная срывается вниз
        if (d.stuck) {
          d.r += dt * (0.9 + speedFactor * 0.4);
          if (d.r >= RUN_THRESHOLD || (speedFactor > 0.5 && d.r > RUN_THRESHOLD - 1.2)) {
            d.stuck = false;
          }
        }

        if (!d.stuck) {
          // Текущая капля: тяжелет вниз, легкий боковой дрейф, ускоряется
          d.vy += GRAVITY * dt * (0.34 + speedFactor * 0.16);
          d.vy = Math.min(d.vy, 900);
          d.vx += (Math.random() - 0.5) * 12 * dt;
          d.y += d.vy * dt;
          d.x += d.vx * dt;
        }

        if (d.life >= d.maxLife || d.y > height + 30) {
          d.active = false;
          continue;
        }

        const headAlpha = Math.min(1, d.life * 4) * Math.min(1, (d.maxLife - d.life) * 3);
        const speedFade = Math.min(1, 0.7 + speedFactor * 0.3);

        // След текущей капли
        if (!d.stuck && d.vy > 20) {
          const trailLen = Math.min(140, d.vy * 0.16);
          const grad = ctx.createLinearGradient(d.x, d.y - trailLen, d.x, d.y);
          grad.addColorStop(0, 'rgba(200,220,238,0)');
          grad.addColorStop(1, `rgba(200,220,238,${0.16 * headAlpha * speedFade})`);
          ctx.strokeStyle = grad;
          ctx.lineWidth = d.r * 0.9;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(d.x, d.y - trailLen);
          ctx.lineTo(d.x, d.y);
          ctx.stroke();
        }

        // Голова капли — блик + капля
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(176,200,222,${0.22 * headAlpha * speedFade})`;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(d.x - d.r * 0.3, d.y - d.r * 0.3, d.r * 0.35, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(235,244,252,${0.4 * headAlpha * speedFade})`;
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 z-[5]"
      style={{ imageRendering: 'auto' }}
    />
  );
};
