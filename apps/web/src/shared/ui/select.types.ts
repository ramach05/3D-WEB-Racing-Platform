export type TSelectOption<T extends string> = {
  /** Option value */
  value: T;
  /** Label in the UI */
  label: string;
};

export type TSelectProps<T extends string> = {
  /** aria-label of the trigger */
  label: string;
  /** Current value */
  value: T;
  /** List of options */
  options: TSelectOption<T>[];
  /** Value change callback */
  onChange: (value: T) => void;
  /** Extra root classes */
  className?: string;
  /** Trigger size */
  size?: 'md' | 'sm';
};
