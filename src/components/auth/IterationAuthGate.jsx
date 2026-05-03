import { useEffect, useState } from 'react';
import { hasSupabaseClientConfig } from '../../services/supabaseClient';
import {
  getCurrentParticipant,
  sendMagicLink,
  signOutAndResetLocalState,
  subscribeAuthStateChange,
} from '../../services/participantSession';

const IS_DEV = import.meta.env.DEV;
const RESEND_COOLDOWN_SECONDS = 60;

export default function IterationAuthGate({
  children,
  hideChildrenUntilAuthenticated = false,
  dismissible = true,
  variant = 'overlay',
}) {
  const [loading, setLoading] = useState(true);
  const [participant, setParticipant] = useState(null);
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState('');
  const [dismissed, setDismissed] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getCurrentParticipant()
      .then((result) => {
        if (cancelled) return;
        setParticipant(result);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message || 'Failed to initialize authentication.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    const unsubscribe = subscribeAuthStateChange((result) => {
      setParticipant(result);
      if (result?.participantId) {
        setWaiting(false);
        setError('');
        setDismissed(false);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (cooldownSeconds <= 0) return undefined;
    const intervalId = window.setInterval(() => {
      setCooldownSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, [cooldownSeconds]);

  async function handleSendLink(event) {
    event.preventDefault();
    const targetEmail = email.trim();
    if (!targetEmail) {
      setError('Please enter an email address.');
      return;
    }
    setError('');
    setSending(true);
    try {
      await sendMagicLink(targetEmail, window.location.href);
      setWaiting(true);
      setCooldownSeconds(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      const message = err?.message || 'Failed to send magic link.';
      if (message.toLowerCase().includes('rate limit')) {
        setError(
          'Email rate limit reached. Please wait about 60 seconds and try again, or use a different email.',
        );
      } else {
        setError(message);
      }
    } finally {
      setSending(false);
    }
  }

  if (!hasSupabaseClientConfig()) {
    return children;
  }

  const authenticated = Boolean(participant?.participantId);
  const sendDisabled = sending || cooldownSeconds > 0;

  const showAuthPrompt = !loading && !authenticated;
  const shouldRenderChildren =
    !showAuthPrompt || !hideChildrenUntilAuthenticated || !hasSupabaseClientConfig();
  const inlinePrompt = variant === 'inline';

  return (
    <>
      {shouldRenderChildren && children}
      {showAuthPrompt && (!dismissed || !dismissible) && (
        <div
          className={inlinePrompt ? 'stage-auth-inline' : 'stage-auth-overlay'}
          role={inlinePrompt ? undefined : 'dialog'}
          aria-modal={inlinePrompt ? undefined : 'true'}
          onClick={() => {
            if (!inlinePrompt && dismissible) setDismissed(true);
          }}
        >
          <div className='stage-auth-card' onClick={(e) => e.stopPropagation()}>
            {dismissible && (
              <button
                type='button'
                className='stage-auth-close'
                onClick={() => setDismissed(true)}
                aria-label='Close sign in popup'
              >
                ×
              </button>
            )}
            <h2>Sign in to continue</h2>
            <p>
              Enter your email to receive a magic link. Your progress across
              iterations will be saved to your session.
            </p>
            <form onSubmit={handleSendLink} className='stage-auth-form'>
              <input
                className='stage-auth-input'
                type='email'
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder='you@example.com'
                required
              />
              <button
                type='submit'
                className='stage-auth-btn'
                disabled={sendDisabled}
              >
                {sending
                  ? 'Sending...'
                  : cooldownSeconds > 0
                    ? `Resend in ${cooldownSeconds}s`
                    : 'Send Magic Link'}
              </button>
            </form>
            {waiting && (
              <p className='stage-auth-note'>
                Check your inbox, then click the link to continue.
              </p>
            )}
            {cooldownSeconds > 0 && (
              <p className='stage-auth-note'>
                To reduce rate-limit failures, wait for the timer before sending
                another link.
              </p>
            )}
            {error && <p className='stage-auth-error'>{error}</p>}
            {IS_DEV && (
              <button
                type='button'
                className='stage-auth-reset'
                onClick={() => {
                  void signOutAndResetLocalState().then(() =>
                    window.location.reload(),
                  );
                }}
              >
                Reset Demo State (Dev)
              </button>
            )}
          </div>
        </div>
      )}
      {showAuthPrompt && dismissed && dismissible && (
        <button
          type='button'
          className='stage-auth-reopen'
          onClick={() => setDismissed(false)}
        >
          Sign in for iterations
        </button>
      )}
      <style>{`
        .stage-auth-inline {
          display: block;
        }
        .stage-auth-overlay {
          position: fixed;
          inset: 0;
          background: rgba(2, 6, 23, 0.65);
          backdrop-filter: blur(4px);
          z-index: 999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
        }
        .stage-auth-card {
          position: relative;
          width: min(520px, 94vw);
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 1.3rem;
          box-shadow: 0 20px 56px rgba(0, 0, 0, 0.35);
        }
        .stage-auth-inline .stage-auth-card {
          width: 100%;
          max-width: 720px;
          box-shadow: none;
        }
        .stage-auth-close {
          position: absolute;
          top: 0.5rem;
          right: 0.5rem;
          border: none;
          background: transparent;
          color: var(--muted);
          font-size: 1.4rem;
          line-height: 1;
          cursor: pointer;
          padding: 0.2rem 0.45rem;
        }
        .stage-auth-card h2 {
          margin: 0 0 0.55rem 0;
          font-size: 1.25rem;
        }
        .stage-auth-card p {
          margin: 0 0 0.8rem 0;
          color: var(--muted);
        }
        .stage-auth-form {
          display: flex;
          gap: 0.55rem;
          flex-wrap: wrap;
        }
        .stage-auth-input {
          flex: 1 1 240px;
          min-width: 240px;
          padding: 0.72rem 0.95rem;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          color: var(--text);
        }
        .stage-auth-btn {
          border: none;
          border-radius: var(--radius);
          padding: 0.72rem 1rem;
          background: var(--accent);
          color: #fff;
          font-weight: 600;
          cursor: pointer;
        }
        .stage-auth-btn:disabled {
          opacity: 0.65;
          cursor: default;
        }
        .stage-auth-note {
          color: var(--text);
          margin-top: 0.8rem;
        }
        .stage-auth-error {
          margin-top: 0.8rem;
          color: #fca5a5 !important;
        }
        .stage-auth-reset {
          margin-top: 0.7rem;
          border: 1px solid var(--border);
          border-radius: 999px;
          background: transparent;
          color: var(--muted);
          padding: 0.38rem 0.7rem;
          font-size: 0.82rem;
        }
        .stage-auth-reopen {
          position: fixed;
          right: 1rem;
          bottom: 1rem;
          z-index: 998;
          border: 1px solid var(--border);
          border-radius: 999px;
          background: var(--surface);
          color: var(--text);
          padding: 0.55rem 0.9rem;
          font-size: 0.88rem;
        }
      `}</style>
    </>
  );
}
