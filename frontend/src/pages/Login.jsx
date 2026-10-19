import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Building2, ArrowRight, Lock, Mail, AlertCircle } from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const user = await login(email, password);
      if (user.role === 'owner') {
        navigate('/owner-dashboard');
      } else {
        navigate('/tenant-dashboard');
      }
    } catch (err) {
      setError(err.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (role) => {
    if (role === 'tenant') {
      setEmail('student@example.com');
      setPassword('password123');
    } else {
      setEmail('manoj.portfolio.website@gmail.com');
      setPassword('password123');
    }
  };

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
      minHeight: 'calc(100vh - 72px)',
      background: 'var(--bg-main)',
    }}>
      {/* Left visual banner */}
      <div style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        padding: '60px 48px',
        overflow: 'hidden',
        minHeight: '400px',
      }}>
        <img
          src="https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=1200&q=80"
          alt="pgbook living space"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, rgba(25, 30, 26, 0.2) 0%, rgba(25, 30, 26, 0.85) 100%)',
        }} />
        <div style={{ position: 'relative', zIndex: 1, color: '#ffffff' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 14px',
            borderRadius: '20px',
            background: 'rgba(255, 255, 255, 0.15)',
            backdropFilter: 'blur(8px)',
            fontSize: '0.8rem',
            fontWeight: '600',
            marginBottom: '16px',
            letterSpacing: '0.04em',
          }}>
            <span>✨ INDIA'S GROWN-UP PG PLATFORM</span>
          </div>
          <h2 style={{ fontSize: '2.4rem', lineHeight: 1.15, marginBottom: '12px', color: '#ffffff' }}>
            Find a room that feels like <span style={{ color: '#e07a5f' }}>home.</span>
          </h2>
          <p style={{ color: 'rgba(255, 255, 255, 0.85)', fontSize: '0.95rem', maxWidth: '440px', lineHeight: 1.6 }}>
            Verified student and executive PGs across Jaipur, Neemrana, Behror, and Kotputli.
          </p>
        </div>
      </div>

      {/* Right sign in form */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '60px 48px',
        maxWidth: '540px',
        margin: '0 auto',
        width: '100%',
      }}>
        <div style={{ marginBottom: '32px' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: '700', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '8px' }}>
            WELCOME BACK
          </div>
          <h1 style={{ fontSize: '2.2rem', fontWeight: '800', marginBottom: '8px' }}>
            Sign in to pgbook<span style={{ color: 'var(--accent-primary)' }}>.</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Enter your details below to access your account.
          </p>
        </div>

        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 16px',
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            borderRadius: '8px',
            color: '#dc2626',
            fontSize: '0.88rem',
            marginBottom: '20px',
          }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '6px' }}>
              Email address
            </label>
            <input
              type="email"
              required
              className="input-clean"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                Password
              </label>
            </div>
            <input
              type="password"
              required
              className="input-clean"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
            style={{ width: '100%', padding: '12px', fontSize: '1rem', marginTop: '6px' }}
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        {/* Demo Quick Logins */}
        <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: '600', marginBottom: '10px' }}>
            DEMO ACCOUNTS (1-CLICK TEST)
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={() => handleQuickLogin('tenant')}
              className="btn-secondary"
              style={{ flex: 1, padding: '8px 12px', fontSize: '0.82rem' }}
            >
              Demo Student
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin('owner')}
              className="btn-secondary"
              style={{ flex: 1, padding: '8px 12px', fontSize: '0.82rem' }}
            >
              Demo PG Owner
            </button>
          </div>
        </div>

        <div style={{ marginTop: '28px', textAlign: 'center', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          Don't have an account?{' '}
          <Link to="/register" style={{ color: 'var(--accent-primary)', fontWeight: '600' }}>
            Get started
          </Link>
        </div>
      </div>
    </div>
  );
}
