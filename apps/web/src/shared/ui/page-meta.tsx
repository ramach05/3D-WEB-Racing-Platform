import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

type TPageMetaProps = {
  /** Page title without the product suffix */
  title: string;
};

/** Sets document.title on mount/prop change; re-syncs on locale switch; renders nothing */
export const PageMeta = ({ title }: TPageMetaProps) => {
  const { t } = useTranslation();

  // Update document.title on mount and when title or locale changes
  useEffect(() => {
    document.title = `${title} — ${t('meta.product')}`;
  }, [title, t]);

  return null;
};
