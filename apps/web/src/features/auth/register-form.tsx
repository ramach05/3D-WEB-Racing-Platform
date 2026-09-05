import { type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getRtkErrorMessage } from '@/shared/lib';
import { Button, TextField } from '@/shared/ui';
import { useRegisterMutation } from './api';
import { isValidNickname, isValidPassword } from './validation';

/** Форма регистрации с клиентской валидацией и ошибками API */
export const RegisterForm = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [register, { isLoading }] = useRegisterMutation();
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [nicknameError, setNicknameError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const nextNicknameError = isValidNickname(nickname) ? null : t('auth.invalidNickname');
    const nextPasswordError = isValidPassword(password) ? null : t('auth.passwordMin');
    setNicknameError(nextNicknameError);
    setPasswordError(nextPasswordError);
    setFormError(null);
    if (nextNicknameError || nextPasswordError) {
      return;
    }

    try {
      await register({ nickname: nickname.trim(), password }).unwrap();
      void navigate('/profile');
    } catch (error) {
      if (error && typeof error === 'object' && 'status' in error) {
        setFormError(getRtkErrorMessage(error as Parameters<typeof getRtkErrorMessage>[0]));
        return;
      }
      setFormError(t('auth.registerTitle'));
    }
  };

  return (
    <>
      <h1 className="text-3xl font-semibold">{t('auth.registerTitle')}</h1>
      <form
        className="mt-6 flex max-w-md flex-col gap-4"
        onSubmit={(event) => void onSubmit(event)}
        noValidate
      >
        <TextField
          label={t('auth.nickname')}
          name="nickname"
          autoComplete="username"
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
          error={nicknameError}
          required
        />
        <TextField
          label={t('auth.password')}
          name="password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={passwordError}
          required
        />
        {formError ? (
          <p role="alert" className="text-sm text-[var(--danger)]">
            {formError}
          </p>
        ) : null}
        <Button type="submit" disabled={isLoading}>
          {t('auth.submitRegister')}
        </Button>
      </form>
      <p className="mt-4">
        <Link to="/login" className="text-sm text-[var(--accent)] underline">
          {t('auth.toLogin')}
        </Link>
      </p>
    </>
  );
};
