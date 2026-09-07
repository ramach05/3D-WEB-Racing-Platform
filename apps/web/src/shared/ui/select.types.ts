export type TSelectOption<T extends string> = {
  value: T;
  label: string;
};

export type TSelectProps<T extends string> = {
  label: string;
  value: T;
  options: TSelectOption<T>[];
  onChange: (value: T) => void;
  className?: string;
  size?: 'md' | 'sm';
};
