import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cx } from '@/shared/lib';

type TButtonVariant = 'primary' | 'ghost' | 'danger';
type TButtonSize = 'md' | 'sm';

type TButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Visual variant */
  variant?: TButtonVariant;
  /** Size */
  size?: TButtonSize;
  /** Label / icon */
  children: ReactNode;
};

/** SEGA-style button with visible focus */
export const Button = forwardRef<HTMLButtonElement, TButtonProps>(
  ({ variant = 'primary', size = 'md', className, type = 'button', children, ...rest }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cx(
          'sega-btn',
          size === 'sm' ? 'sega-btn--sm' : '',
          variant === 'ghost' ? 'sega-btn--ghost' : '',
          variant === 'danger' ? 'bg-[var(--danger)] text-white' : '',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className ?? '',
        )}
        {...rest}
      >
        {children}
      </button>
    );
  },
);

Button.displayName = 'Button';
