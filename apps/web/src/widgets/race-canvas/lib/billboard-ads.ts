import { CanvasTexture, LinearFilter, SRGBColorSpace } from 'three';
import type { TBillboardAdId } from '@/entities/track';
import { billboardPalette, type TAppLocale } from '@/shared/config';

type TBillboardAdCopy = {
  /** Название бренда */
  brand: string;
  /** Главный слоган */
  slogan: string;
  /** Вторая шутка / мотивация */
  punchline: string;
  /** Мелкая строка внизу */
  tagline: string;
};

const AD_COPY: Record<TAppLocale, Record<TBillboardAdId, TBillboardAdCopy>> = {
  en: {
    'torque-cola': {
      brand: 'TORQUE COLA',
      slogan: 'Taste like victory. Feels like a fine.',
      punchline: 'Drink first. Apologize to the wall later.',
      tagline: 'MAY CAUSE UNFORCED OVERTAKES',
    },
    'apex-tires': {
      brand: 'APEX TIRES',
      slogan: 'If you can still steer, buy cheaper tires.',
      punchline: 'We turn “oh no” into “still going”.',
      tagline: 'SIDEWALL WARRANTY VOID IF YOU WERE RIGHT',
    },
    'nitro-donuts': {
      brand: 'NITRO DONUTS',
      slogan: 'Round. Sticky. Faster than your lap.',
      punchline: 'One bite = one reckless idea.',
      tagline: 'PIT LANE SPECIAL: FREE REGRET WITH EVERY BOX',
    },
    'pitstop-insurance': {
      brand: 'PITSTOP INSURANCE',
      slogan: 'Crash now. Brag later.',
      punchline: 'We insure ego, gravity, and bad decisions.',
      tagline: '*COVERS 360° SPINS — AND YOUR GROUP CHAT',
    },
    'for-rent': {
      brand: '',
      slogan: 'Your ad here',
      punchline: '',
      tagline: '',
    },
  },
  ru: {
    'torque-cola': {
      brand: 'TORQUE COLA',
      slogan: 'Вкус победы. Послевкусие штрафа.',
      punchline: 'Сначала глоток — потом извинения стене.',
      tagline: 'МОЖЕТ ВЫЗВАТЬ ЛИШНИЕ ОБГОНЫ',
    },
    'apex-tires': {
      brand: 'APEX TIRES',
      slogan: 'Если ещё рулишь — бери дешевле.',
      punchline: 'Превращаем «ой» в «ещё едет».',
      tagline: 'ГАРАНТИЯ БОКОВИН НЕ ДЕЙСТВУЕТ, ЕСЛИ ТЫ БЫЛ ПРАВ',
    },
    'nitro-donuts': {
      brand: 'NITRO DONUTS',
      slogan: 'Круглые. Липкие. Быстрее твоего круга.',
      punchline: 'Один укус — одна безумная идея.',
      tagline: 'АКЦИЯ ПИТ-ЛЕЙНА: ЖАЛОСТЬ В ПОДАРОК',
    },
    'pitstop-insurance': {
      brand: 'PITSTOP INSURANCE',
      slogan: 'Врежься сейчас. Хвастайся потом.',
      punchline: 'Страхуем эго, гравитацию и плохие решения.',
      tagline: '*ПОКРЫВАЕМ 360° И ТВОЙ ГРУППОВОЙ ЧАТ',
    },
    'for-rent': {
      brand: '',
      slogan: 'Место для вашей рекламы',
      punchline: '',
      tagline: '',
    },
  },
};

const TEXTURE_WIDTH = 1024;
const TEXTURE_HEIGHT = 512;

/** Рисует пунктирный прямоугольник для for-rent */
const strokeDashedRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  dash: number,
): void => {
  ctx.setLineDash([dash, dash * 0.65]);
  ctx.strokeRect(x, y, w, h);
  ctx.setLineDash([]);
};

/** Укорачивает строку под ширину canvas */
const fitText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string => {
  if (ctx.measureText(text).width <= maxWidth) {
    return text;
  }
  let truncated = text;
  while (truncated.length > 1 && ctx.measureText(`${truncated}…`).width > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return `${truncated}…`;
};

/** Генерирует canvas-текстуру рекламного макета на выбранном языке */
export const createBillboardTexture = (
  adId: TBillboardAdId,
  locale: TAppLocale = 'en',
): CanvasTexture => {
  const canvas = document.createElement('canvas');
  canvas.width = TEXTURE_WIDTH;
  canvas.height = TEXTURE_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('2d canvas context unavailable');
  }

  const colors = billboardPalette.ads[adId];
  const copy = AD_COPY[locale][adId];
  const maxTextWidth = TEXTURE_WIDTH - 96;

  // Фон
  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, TEXTURE_WIDTH, TEXTURE_HEIGHT);

  if (adId === 'for-rent') {
    // Белый щит: пунктирная рамка + одна надпись по центру
    ctx.strokeStyle = colors.foreground;
    ctx.lineWidth = 6;
    strokeDashedRect(ctx, 72, 72, TEXTURE_WIDTH - 144, TEXTURE_HEIGHT - 144, 18);

    ctx.fillStyle = colors.foreground;
    ctx.font = '700 48px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(fitText(ctx, copy.slogan, maxTextWidth), TEXTURE_WIDTH / 2, TEXTURE_HEIGHT / 2);
  } else {
    // Тонкая «металлическая» кромка
    ctx.strokeStyle = billboardPalette.bolt;
    ctx.lineWidth = 10;
    ctx.strokeRect(8, 8, TEXTURE_WIDTH - 16, TEXTURE_HEIGHT - 16);

    // Акцентная полоса сверху / снизу
    ctx.fillStyle = colors.accent;
    ctx.fillRect(0, 0, TEXTURE_WIDTH, 28);
    ctx.fillRect(0, TEXTURE_HEIGHT - 28, TEXTURE_WIDTH, 28);

    // Декоративный «лого-блок»
    ctx.fillStyle = colors.accent;
    ctx.beginPath();
    ctx.moveTo(48, 78);
    ctx.lineTo(140, 78);
    ctx.lineTo(118, 138);
    ctx.lineTo(48, 138);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = colors.foreground;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = '800 56px system-ui, sans-serif';
    ctx.fillText(fitText(ctx, copy.brand, TEXTURE_WIDTH - 220), 168, 108);

    ctx.fillStyle = colors.muted;
    ctx.font = '600 22px system-ui, sans-serif';
    ctx.fillText(fitText(ctx, copy.tagline, TEXTURE_WIDTH - 220), 168, 156);

    ctx.fillStyle = colors.foreground;
    ctx.font = '700 42px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(fitText(ctx, copy.slogan, maxTextWidth), TEXTURE_WIDTH / 2, TEXTURE_HEIGHT / 2 + 36);

    ctx.fillStyle = colors.accent;
    ctx.font = '700 28px system-ui, sans-serif';
    ctx.fillText(
      fitText(ctx, copy.punchline, maxTextWidth),
      TEXTURE_WIDTH / 2,
      TEXTURE_HEIGHT / 2 + 92,
    );

    // Нижняя полоска
    ctx.fillStyle = colors.accent;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(120, TEXTURE_HEIGHT - 88, TEXTURE_WIDTH - 240, 6);
    ctx.globalAlpha = 1;
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
};

export const BILLBOARD_AD_COPY = AD_COPY;

/** Копия макета для тестов / UI */
export const getBillboardAdCopy = (
  adId: TBillboardAdId,
  locale: TAppLocale,
): TBillboardAdCopy => AD_COPY[locale][adId];
