import type { FormEvent } from 'react';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface LocationState {
  from?: {
    pathname?: string;
  };
}

export function LoginPage() {
  const { login, continueAsGuest } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState | null;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      const redirectTo = state?.from?.pathname ?? '/';
      navigate(redirectTo, { replace: true });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      setError('Invalid credentials or server error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleContinueAsGuest = () => {
    continueAsGuest();
    const redirectTo = state?.from?.pathname ?? '/';
    navigate(redirectTo, { replace: true });
  };

  return (
    <div className="fullscreen-center">
      <div className="card card-auth">
        <h1 className="card-title">Empress Raid Tracker</h1>
        <p className="card-subtitle">Sign in to manage your runs</p>
        <form onSubmit={handleSubmit} className="form">
          <label className="form-field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </label>
          <label className="form-field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </label>
          {error && <p className="form-error">{error}</p>}
          <button
            type="submit"
            className="app-button-primary"
            disabled={submitting}
          >
            {submitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
        <div style={{ marginTop: '1rem', textAlign: 'center' }}>
          <p className="muted" style={{ marginBottom: '0.5rem' }}>
            or
          </p>
          <button
            type="button"
            className="app-button-ghost"
            onClick={handleContinueAsGuest}
          >
            Continue as Visitor
          </button>
          <p className="muted" style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}>
            View-only access, no editing
          </p>
        </div>
      </div>
    </div>
  );
}

