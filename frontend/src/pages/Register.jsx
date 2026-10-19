import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Building2, User, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [role, setRole] = useState('tenant'); // 'tenant' or 'owner'
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const user = await register({
        full_name: fullName,
        email,
        phone,
        password,
        role,
      });

      if (user.role === 'owner') {
        navigate('/owner-dashboard');
      } else {
        navigate('/tenant-dashboard');
      }
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
      minHeight: 'calc(100vh - 72px)',
      background: 'var(--bg-main)',
    }}>
      {/* Left visual hero banner */}
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
          src="https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?auto=format&fit=crop&w=1200&q=80"
          alt="Modern pg residence"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, rgba(25, 30, 26, 0.25) 0%, rgba(25, 30, 26, 0.88) 100%)',
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
            <span>✨ VERIFIED PG RESIDENCES</span>
          </div>
          <h2 style={{ fontSize: '2.4rem', lineHeight: 1.15, marginBottom: '12px', color: '#ffffff' }}>
            Live where the <span style={{ color: '#e07a5f' }}>work is.</span>
          </h2>
          <p style={{ color: 'rgba(255, 255, 255, 0.85)', fontSize: '0.95rem', maxWidth: '440px', lineHeight: 1.6 }}>
            Instant bed lock, transparent security deposits, zero brokerage across Rajasthan & NCR.
          </p>
        </div>
      </div>

      {/* Right registration form */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '50px 48px',
        maxWidth: '540px',
        margin: '0 auto',
        width: '100%',
      }}>
        <div style={{ marginBottom: '28px' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: '700', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '8px' }}>
            CREATE ACCOUNT
          </div>
          <h1 style={{ fontSize: '2.2rem', fontWeight: '800', marginBottom: '8px' }}>
            Start your journey<span style={{ color: 'var(--accent-primary)' }}>.</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Join thousands of residents and verified owners on pgbook.
          </p>
        </div>

        {/* Dual Role Toggle matching pgbook. */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
          <button
            type="button"
            onClick={() => setRole('tenant')}
            style={{
              padding: '12px 16px',
              borderRadius: '8px',
              border: role === 'tenant' ? '2px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
              background: role === 'tenant' ? 'var(--accent-primary-soft)' : '#ffffff',
              color: role === 'tenant' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              fontWeight: '600',
              fontSize: '0.92rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            I'm looking for a PG
          </button>

          <button
            type="button"
            onClick={() => setRole('owner')}
            style={{
              padding: '12px 16px',
              borderRadius: '8px',
              border: role === 'owner' ? '2px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
              background: role === 'owner' ? 'var(--accent-primary-soft)' : '#ffffff',
              color: role === 'owner' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              fontWeight: '600',
              fontSize: '0.92rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            I own a PG
          </button>
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
              Full name
            </label>
            <input
              type="text"
              required
              className="input-clean"
              placeholder="e.g. Manoj Kumar"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>

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
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '6px' }}>
              Phone (optional)
            </label>
            <input
              type="tel"
              className="input-clean"
              placeholder="+91 98765 43210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '6px' }}>
              Password (min 6 chars)
            </label>
            <input
              type="password"
              required
              minLength={6}
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
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <div style={{ marginTop: '28px', textAlign: 'center', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--accent-primary)', fontWeight: '600' }}>
            Log in
          </Link>
        </div>
      </div>
    </div>
  );
}
