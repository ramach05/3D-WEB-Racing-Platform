import { type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getRtkErrorMessage } from '@/shared/lib';
import { Button, TextField } from '@/shared/ui';
import { useLoginMutation } from './api';
import { isValidNickname, isValidPassword } from './validation';

/** Login form with client-side validation and API errors */
export const LoginForm = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [login, { isLoading }] = useLoginMutation();
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [nicknameError, setNicknameError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Validation and login mutation call
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
      await login({ nickname: nickname.trim(), password }).unwrap();
      void navigate('/profile');
    } catch (error) {
      if (error && typeof error === 'object' && 'status' in error) {
        setFormError(getRtkErrorMessage(error as Parameters<typeof getRtkErrorMessage>[0]));
        return;
      }
      setFormError(t('auth.loginTitle'));
    }
  };

  return (
    <>
      <h1 className="text-3xl font-semibold">{t('auth.loginTitle')}</h1>
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
          autoComplete="current-password"
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
          {t('auth.submitLogin')}
        </Button>
      </form>
      <p className="mt-4">
        <Link to="/register" className="text-sm text-[var(--accent)] underline">
          {t('auth.toRegister')}
        </Link>
      </p>
    </>
  );
};
