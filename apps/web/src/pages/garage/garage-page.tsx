import { useTranslation } from 'react-i18next';
import { VEHICLES } from '@/entities/vehicle';
import { useSelectedVehicle } from '@/features/vehicle-select';
import { carSkins } from '@/shared/config';
import { cx } from '@/shared/lib';
import { PageShell } from '@/shared/ui';
import { VehiclePreview } from '@/widgets/vehicle-preview';

const previewBody = carSkins.coastal.body;
const previewNight = carSkins.night.body;

/** Гараж: выбор кузова (цвет задаёт трасса в заезде) */
export const GaragePage = () => {
  const { t } = useTranslation();
  const { vehicleId, selectVehicle } = useSelectedVehicle();

  return (
    <PageShell>
      <h1 className="text-3xl font-semibold uppercase text-[var(--sega-yellow)]">
        {t('garage.title')}
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">{t('garage.subtitle')}</p>
      <div className="mt-3 flex items-center gap-3 text-xs uppercase text-[var(--muted)]">
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block size-3 border border-[var(--border)]"
            style={{ background: previewBody }}
            aria-hidden
          />
          {t('garage.dayColor')}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block size-3 border border-[var(--border)]"
            style={{ background: previewNight }}
            aria-hidden
          />
          {t('garage.nightColor')}
        </span>
      </div>

      <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 sm:items-stretch">
        {VEHICLES.map((vehicle) => {
          const selected = vehicle.id === vehicleId;
          return (
            <li key={vehicle.id} className="h-full">
              <button
                type="button"
                onClick={() => selectVehicle(vehicle.id)}
                aria-pressed={selected}
                className={cx(
                  'sega-panel sega-card-link flex h-full w-full flex-col p-4 text-left no-underline',
                  selected && 'border-[var(--sega-yellow)] ring-2 ring-[var(--sega-yellow)]',
                )}
              >
                <div className="w-full border-2 border-[var(--border)] bg-[var(--bg)]">
                  <VehiclePreview vehicleId={vehicle.id} className="aspect-[16/10] w-full" />
                </div>
                <h2 className="mt-3 text-lg font-medium text-[var(--sega-cyan)]">
                  {t(`garage.vehicles.${vehicle.id}.name`)}
                </h2>
                <p className="mt-1 flex-1 text-sm text-[var(--muted)]">
                  {t(`garage.vehicles.${vehicle.id}.description`)}
                </p>
                {selected ? (
                  <span className="mt-4 inline-flex self-start border-[length:var(--pixel-border)] border-[var(--border)] bg-[var(--sega-yellow)] px-3 py-1.5 text-sm font-semibold uppercase tracking-wide text-[var(--on-yellow)] shadow-[3px_3px_0_0_var(--sega-magenta)]">
                    {t('garage.selected')}
                  </span>
                ) : (
                  <span className="mt-4 inline-flex min-h-[2.375rem] self-start" aria-hidden />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </PageShell>
  );
};
