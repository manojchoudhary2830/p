import React, { useState } from 'react';
import { X, Lock, Mail, User, Phone, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';

export default function AuthModal({ isOpen, onClose, initialTab = 'login' }) {
  const { login, register } = useAuth();
  const [tab, setTab] = useState(initialTab); // 'login', 'register', 'forgot'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('tenant');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (tab === 'login') {
        await login(email, password);
        onClose();
      } else if (tab === 'register') {
        await register({
          email,
          password,
          full_name: fullName,
          phone,
          role,
        });
        onClose();
      } else if (tab === 'forgot') {
        const res = await api.forgotPassword({ email });
        setSuccess(res.message || 'Password reset instructions have been sent.');
      }
    } catch (err) {
      if (err.status === 429) {
        setError(`Rate limit reached: ${err.message}`);
      } else {
        setError(err.message || 'An error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (demoRole) => {
    if (demoRole === 'tenant') {
      setEmail('student@example.com');
      setPassword('password123');
    } else {
      setEmail('manoj.portfolio.website@gmail.com');
      setPassword('password123');
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 200,
      background: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
    }}>
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: '440px',
        padding: '32px',
        position: 'relative',
        background: '#111827',
      }}>
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
          }}
        >
          <X size={20} />
        </button>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '6px' }}>
            {tab === 'login' && 'Welcome Back'}
            {tab === 'register' && 'Create Your Account'}
            {tab === 'forgot' && 'Reset Password'}
          </h2>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
            {tab === 'login' && 'Access verified student & professional PGs'}
            {tab === 'register' && 'Book beds or list properties in Jaipur & NCR'}
            {tab === 'forgot' && 'Enter your email to receive a secure reset link'}
          </p>
        </div>

        {/* Quick Demo Fill Buttons */}
        {tab === 'login' && (
          <div style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '20px',
            padding: '10px',
            background: 'rgba(255, 255, 255, 0.03)',
            borderRadius: '8px',
            border: '1px dashed var(--border-glass)',
          }}>
            <button
              type="button"
              onClick={() => handleQuickLogin('tenant')}
              style={{
                flex: 1,
                fontSize: '0.78rem',
                padding: '6px',
                borderRadius: '6px',
                background: 'rgba(59, 130, 246, 0.15)',
                color: '#60a5fa',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                cursor: 'pointer',
              }}
            >
              Demo Student
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin('owner')}
              style={{
                flex: 1,
                fontSize: '0.78rem',
                padding: '6px',
                borderRadius: '6px',
                background: 'rgba(245, 158, 11, 0.15)',
                color: '#fbbf24',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                cursor: 'pointer',
              }}
            >
              Demo PG Owner
            </button>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 14px',
            background: 'rgba(244, 63, 94, 0.15)',
            border: '1px solid rgba(244, 63, 94, 0.3)',
            borderRadius: '8px',
            color: '#fb7185',
            fontSize: '0.85rem',
            marginBottom: '16px',
          }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Success message */}
        {success && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 14px',
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '8px',
            color: '#34d399',
            fontSize: '0.85rem',
            marginBottom: '16px',
          }}>
            <CheckCircle2 size={16} />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {tab === 'register' && (
            <>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  className="input-glass"
                  placeholder="e.g. Aman Sharma"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>
                  Phone Number
                </label>
                <input
                  type="tel"
                  required
                  className="input-glass"
                  placeholder="+91 98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>
                  Account Type
                </label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setRole('tenant')}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: '8px',
                      fontSize: '0.85rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      background: role === 'tenant' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                      color: role === 'tenant' ? '#60a5fa' : 'var(--text-secondary)',
                      border: role === 'tenant' ? '1px solid #3b82f6' : '1px solid var(--border-glass)',
                    }}
                  >
                    Student / Tenant
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('owner')}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: '8px',
                      fontSize: '0.85rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      background: role === 'owner' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                      color: role === 'owner' ? '#fbbf24' : 'var(--text-secondary)',
                      border: role === 'owner' ? '1px solid #f59e0b' : '1px solid var(--border-glass)',
                    }}
                  >
                    PG Owner
                  </button>
                </div>
              </div>
            </>
          )}

          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>
              Email Address
            </label>
            <input
              type="email"
              required
              className="input-glass"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {tab !== 'forgot' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Password</label>
                {tab === 'login' && (
                  <button
                    type="button"
                    onClick={() => { setTab('forgot'); setError(''); setSuccess(''); }}
                    style={{ background: 'transparent', border: 'none', color: '#60a5fa', fontSize: '0.78rem', cursor: 'pointer' }}
                  >
                    Forgot?
                  </button>
                )}
              </div>
              <input
                type="password"
                required
                className="input-glass"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
            style={{ width: '100%', marginTop: '6px' }}
          >
            {loading ? 'Processing...' : (
              tab === 'login' ? 'Sign In' : tab === 'register' ? 'Register Now' : 'Send Reset Link'
            )}
          </button>
        </form>

        {/* Footer switcher */}
        <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          {tab === 'login' && (
            <p>
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => { setTab('register'); setError(''); setSuccess(''); }}
                style={{ background: 'transparent', border: 'none', color: '#60a5fa', fontWeight: '600', cursor: 'pointer' }}
              >
                Sign up
              </button>
            </p>
          )}
          {tab === 'register' && (
            <p>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => { setTab('login'); setError(''); setSuccess(''); }}
                style={{ background: 'transparent', border: 'none', color: '#60a5fa', fontWeight: '600', cursor: 'pointer' }}
              >
                Sign in
              </button>
            </p>
          )}
          {tab === 'forgot' && (
            <button
              type="button"
              onClick={() => { setTab('login'); setError(''); setSuccess(''); }}
              style={{ background: 'transparent', border: 'none', color: '#60a5fa', fontWeight: '600', cursor: 'pointer' }}
            >
              Back to Login
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
