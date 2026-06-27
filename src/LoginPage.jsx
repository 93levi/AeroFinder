import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './LoginPage.css';

const API = 'http://4.237.58.241:3000';

export default function LoginPage() {
  const navigate = useNavigate();

  // Form field values
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');

  // UI state
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();           // stop the browser doing a full page reload
    if (loading) return;          // prevent double-submitting

    setLoading(true);
    setError(null);               // clear any previous error

    try {
      const res = await fetch(`${API}/user/login`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        // API returned an error (wrong credentials etc.)
        // The API puts the message in data.message
        throw new Error(data.message || 'Login failed');
      }

      // Success — store the JWT token in localStorage so it
      // persists across page refreshes and is accessible everywhere
      localStorage.setItem('token', data.token);

      // Send the user back to the landing page
      navigate('/');

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-root">
      <div className="auth-panel">

        <div className="auth-brand">
          <h1 className="auth-title">AeroFinder</h1>
          <p className="auth-sub">Sign in</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>

          <div className="auth-field">
            <label className="auth-label" htmlFor="email">Email</label>
            <input
              id="email"
              className="auth-input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="password">Password</label>
            <input
              id="password"
              className="auth-input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <p className="auth-error">{error}</p>
          )}

          <button
            className="auth-submit"
            type="submit"
            disabled={loading}
          >
            {loading ? 'Signing in…' : 'Login'}
          </button>

        </form>

        <p className="auth-switch">
          No account? <Link to="/register" className="auth-link">Sign up</Link>
        </p>

        <Link to="/" className="auth-back">Back</Link>

      </div>
    </div>
  );
}
