import React from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { RefreshCw, LogIn, CheckCircle } from 'lucide-react';
import { useSyncGoogleContacts, useGoogleAuth } from '../../hooks/useHorizonData';

interface GoogleSyncButtonProps {
  userId: string;
}

export const GoogleSyncButton: React.FC<GoogleSyncButtonProps> = ({ userId }) => {
  const { mutate: syncContacts, isPending: isSyncPending, status: syncStatus } = useSyncGoogleContacts();
  const { mutate: exchangeCode, isPending: isAuthPending } = useGoogleAuth();

  const login = useGoogleLogin({
    flow: 'auth-code',
    onSuccess: (codeResponse) => {
      exchangeCode({
        code: codeResponse.code,
        userId,
        redirectUri: window.location.origin,
      }, {
        onSuccess: (tokenData) => {
          syncContacts({ userId, accessToken: tokenData.access_token });
        },
        onError: (err) => {
          console.error('[HORIZON] Token exchange failed:', err);
        }
      });
    },
    onError: (error) => console.error('[HORIZON] Login Failed:', error),
    scope: 'https://www.googleapis.com/auth/contacts.readonly https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',
  });

  const isPending = isSyncPending || isAuthPending;
  const isDone = syncStatus === 'success';

  const getButtonText = () => {
    if (isAuthPending) return 'Authenticating...';
    if (isSyncPending) return 'Syncing...';
    if (isDone) return 'Synced';
    return 'Sync Google';
  };

  return (
    <button
      onClick={() => login()}
      disabled={isPending}
      className={`
        relative flex items-center justify-center gap-2 px-4 py-2.5
        rounded-xl font-semibold text-xs transition-all duration-300 border
        ${isDone
          ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400'
          : isPending
            ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 cursor-not-allowed'
            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 hover:shadow-md active:scale-95 shadow-sm'
        }
      `}
    >
      {isPending ? (
        <RefreshCw className="w-4 h-4 animate-spin" />
      ) : isDone ? (
        <CheckCircle className="w-4 h-4" />
      ) : (
        <LogIn className="w-4 h-4" />
      )}
      <span className="tracking-wide uppercase">{getButtonText()}</span>
    </button>
  );
};
