/** Сохранённый результат заезда */
export type RaceResultPublic = {
  id: string;
  timeMs: number;
  userId: string;
  trackId: string;
  createdAt: string;
};

/** Создание результата после финиша */
export type CreateRaceResultRequest = {
  trackId: string;
  timeMs: number;
};

/** Нижняя граница времени: отсекаем читы «мгновенный финиш» */
export const RACE_TIME_MIN_MS = 8_000;

/** Верхняя граница: заезд дольше 15 минут не принимаем */
export const RACE_TIME_MAX_MS = 15 * 60 * 1000;
