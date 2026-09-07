export type TSelectOption<T extends string> = {
  /** Значение опции */
  value: T;
  /** Подпись в UI */
  label: string;
};

export type TSelectProps<T extends string> = {
  /** aria-label триггера */
  label: string;
  /** Текущее значение */
  value: T;
  /** Список опций */
  options: TSelectOption<T>[];
  /** Колбэк смены значения */
  onChange: (value: T) => void;
  /** Доп. классы корня */
  className?: string;
  /** Размер триггера */
  size?: 'md' | 'sm';
};
