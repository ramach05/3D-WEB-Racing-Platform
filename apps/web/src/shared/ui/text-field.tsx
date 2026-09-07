import type { InputHTMLAttributes, ReactNode } from 'react';
import { cx } from '@/shared/lib';

type TTextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  /** Подпись поля */
  label: string;
  /** Текст ошибки или null */
  error?: string | null;
};

/** Поле формы с label и текстом ошибки */
export const TextField = ({ label, error, id, className, ...rest }: TTextFieldProps) => {
  const fieldId = id ?? rest.name;
  const errorId = error && fieldId ? `${fieldId}-error` : undefined;

  return (
    <div className={cx('sega-field', className ?? '')}>
      <label htmlFor={fieldId} className="text-sm font-medium">
        {label}
      </label>
      <input id={fieldId} aria-invalid={Boolean(error)} aria-describedby={errorId} {...rest} />
      {error ? (
        <p id={errorId} role="alert" className="sega-field-error text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}
    </div>
  );
};

type TStatusTextProps = {
  /** Текст статуса */
  children: ReactNode;
};

/** Сообщение loading/empty/error */
export const StatusText = ({ children }: TStatusTextProps) => {
  return <p className="mt-3 text-[var(--muted)]">{children}</p>;
};
