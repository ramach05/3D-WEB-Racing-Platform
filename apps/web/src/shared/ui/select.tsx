import { type KeyboardEvent, useCallback, useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/shared/lib';
import type { TSelectProps } from './select.types';

/** Accessible SEGA-style pixel dropdown */
export const Select = <T extends string>({
  label,
  value,
  options,
  onChange,
  className,
  size = 'md',
}: TSelectProps<T>) => {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const selected = options.find((option) => option.value === value) ?? options[0];

  // Closes the dropdown
  const close = useCallback(() => {
    setOpen(false);
  }, []);

  // Close on click outside the list
  useEffect(() => {
    // pointerdown outside the root → close
    const onPointerDown = (event: MouseEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) {
        close();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [close]);

  // Pick an option and close the menu
  const pick = (next: T): void => {
    onChange(next);
    close();
  };

  // Keyboard: open, arrows, Enter, Escape
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    if (!open) {
      if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        setOpen(true);
        setHighlight(options.findIndex((option) => option.value === value));
      }
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlight((current) => (current + 1) % options.length);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlight((current) => (current - 1 + options.length) % options.length);
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      const option = options[highlight];
      if (option) {
        pick(option.value);
      }
    }
  };

  return (
    <div ref={rootRef} className={cx('relative', className ?? '')}>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        className={cx('sega-select-trigger', size === 'sm' ? 'sega-select-trigger--sm' : '')}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={onKeyDown}
      >
        <span className="sr-only">{label}: </span>
        {selected?.label}
        <span aria-hidden className="sega-select-chevron text-[var(--sega-cyan)]">
          ▾
        </span>
      </button>
      {open ? (
        <ul id={listId} role="listbox" aria-label={label} className="sega-select-menu">
          {options.map((option, index) => (
            <li key={option.value} role="option" aria-selected={option.value === value}>
              <button
                type="button"
                className={cx(
                  'sega-select-item',
                  option.value === value ? 'sega-select-item--active' : '',
                  index === highlight ? 'sega-select-item--highlight' : '',
                )}
                onMouseEnter={() => setHighlight(index)}
                onClick={() => pick(option.value)}
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
};
