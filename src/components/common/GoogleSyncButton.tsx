import React from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { RefreshCw, LogIn } from 'lucide-react';
import { useSyncGoogleContacts, useGoogleAuth } from '../../hooks/useHorizonData';

interface GoogleSyncButtonProps {
  userId: string;
}

/**
 * Premium Google Sync Button — Phase 7 | Scale Pivot (REQ-031)
 * Uses Glassmorphism and modern OAuth2 Implicit Flow.
 */
export const GoogleSyncButton: React.FC<GoogleSyncButtonProps> = ({ userId }) => {
  const { mutate: syncContacts, isPending: isSyncPending, status: syncStatus } = useSyncGoogleContacts();
  const { mutate: exchangeCode, isPending: isAuthPending } = useGoogleAuth();

  const login = useGoogleLogin({
    flow: 'auth-code', // REQ-031: Switch to auth-code flow for refresh tokens
    onSuccess: (codeResponse) => {
      console.log('[HORIZON] OAuth Success, exchanging code for tokens...');
      
      exchangeCode({ 
        code: codeResponse.code, 
        userId,
        redirectUri: "http://localhost:3000" 
      }, {
        onSuccess: (tokenData) => {
          console.log('[HORIZON] Persistence enabled. Triggering sync...');
          syncContacts({ 
            userId, 
            accessToken: tokenData.access_token 
          });
        },
        onError: (err) => {
          console.error('[HORIZON] Exchange failed:', err);
        }
      });
    },
    onError: (error) => console.error('[HORIZON] Login Failed:', error),
    scope: 'https://www.googleapis.com/auth/contacts.readonly https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',
  });

  const isPending = isSyncPending || isAuthPending;

  const getButtonText = () => {
    if (isAuthPending) return 'Authenticating...';
    if (isSyncPending) return 'Syncing Intelligence...';
    if (syncStatus === 'success') return 'Synced';
    return 'Sync Google Contacts';
  };

  return (
    <button
      onClick={() => login()}
      disabled={isPending}
      className={`
        relative flex items-center justify-center gap-3 px-6 py-3 
        rounded-xl font-medium transition-all duration-300
        backdrop-blur-md border shadow-lg
        ${isPending 
          ? 'bg-white/5 border-white/10 text-white/40 cursor-not-allowed' 
          : 'bg-white/10 border-white/20 text-white hover:bg-white/20 hover:border-white/40 active:scale-95'
        }
      `}
    >
      {isPending ? (
        <RefreshCw className="w-5 h-5 animate-spin" />
      ) : (
        <LogIn className="w-5 h-5" />
      )}
      <span className="tracking-wide uppercase text-xs font-bold">
        {getButtonText()}
      </span>
      
      {/* Premium glow effect on hover */}
      {!isPending && (
        <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-500/0 via-blue-400/10 to-blue-500/0 opacity-0 hover:opacity-100 transition-opacity" />
      )}
    </button>
  );
};
