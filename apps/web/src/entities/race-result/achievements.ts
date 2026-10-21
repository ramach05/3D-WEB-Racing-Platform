import { TRACK_SLUGS } from '@racing/shared';
import type { TUserStats } from '@racing/shared';

/** Achievement identifiers, also used as i18n key fragments */
export type TAchievementId =
  'first-finish' | 'all-tracks' | 'sub-forty-five' | 'improver' | 'marathon' | 'podium';

/** One achievement with its unlock state and progress toward the target */
export type TAchievement = {
  id: TAchievementId;
  unlocked: boolean;
  progress: number;
  target: number;
};

const SUB_45_MS = 45_000;
const IMPROVEMENT_MS = 2_000;
const MARATHON_RACES = 25;
const PODIUM_RANK = 3;

type TAchievementRule = {
  id: TAchievementId;
  /** Counter compared against target; reaching target unlocks the achievement */
  progress: (stats: TUserStats) => number;
  target: number;
};

const ACHIEVEMENT_RULES: TAchievementRule[] = [
  { id: 'first-finish', progress: (stats) => stats.totalRaces, target: 1 },
  { id: 'all-tracks', progress: (stats) => stats.tracksCompleted, target: TRACK_SLUGS.length },
  {
    id: 'sub-forty-five',
    progress: (stats) => stats.perTrack.filter((row) => row.bestTimeMs < SUB_45_MS).length,
    target: 1,
  },
  {
    id: 'improver',
    progress: (stats) => Math.max(0, ...stats.perTrack.map((row) => row.improvementMs)),
    target: IMPROVEMENT_MS,
  },
  { id: 'marathon', progress: (stats) => stats.totalRaces, target: MARATHON_RACES },
  {
    id: 'podium',
    progress: (stats) => stats.perTrack.filter((row) => row.rank <= PODIUM_RANK).length,
    target: 1,
  },
];

/** Derives the user's achievements from profile stats; progress is clamped to target */
export const getAchievements = (stats: TUserStats): TAchievement[] =>
  ACHIEVEMENT_RULES.map(({ id, progress, target }) => {
    const value = Math.min(progress(stats), target);
    return { id, unlocked: value >= target, progress: value, target };
  });
