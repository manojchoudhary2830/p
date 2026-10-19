import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Building2, User, LogOut, PlusCircle, ShieldCheck, BookmarkCheck, Menu, X, Bell } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Navbar({ onOpenAi }) {
  const { user, isLoggedIn, isOwner, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 100,
      background: 'rgba(255, 255, 255, 0.95)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      borderBottom: '1px solid var(--border-subtle)',
      padding: '14px 0',
      transition: 'all 0.2s ease',
    }}>
      <div className="container">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px' }}>
          
          {/* pgbook. Brand Logo */}
          <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: 'var(--accent-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 2px 8px rgba(200, 90, 56, 0.25)',
              flexShrink: 0,
            }}>
              <Building2 size={20} />
            </div>
            <div style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '1.45rem',
              fontWeight: '800',
              letterSpacing: '-0.03em',
              color: 'var(--text-primary)',
              lineHeight: 1,
            }}>
              pgbook<span style={{ color: 'var(--accent-primary)' }}>.</span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="nav-desktop-links" style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            <Link
              to="/"
              style={{
                fontSize: '0.92rem',
                fontWeight: location.pathname === '/' ? '600' : '500',
                color: location.pathname === '/' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                transition: 'color 0.2s',
              }}
            >
              Discover
            </Link>

            {isLoggedIn && (
              <Link
                to="/tenant-dashboard"
                style={{
                  fontSize: '0.92rem',
                  fontWeight: location.pathname === '/tenant-dashboard' ? '600' : '500',
                  color: location.pathname === '/tenant-dashboard' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  transition: 'color 0.2s',
                }}
              >
                My Bookings
              </Link>
            )}

            {isOwner && (
              <Link
                to="/owner-dashboard"
                style={{
                  fontSize: '0.92rem',
                  fontWeight: location.pathname === '/owner-dashboard' ? '600' : '500',
                  color: location.pathname === '/owner-dashboard' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  transition: 'color 0.2s',
                }}
              >
                Owner Portal
              </Link>
            )}
          </nav>

          {/* Desktop Action Controls */}
          <div className="nav-desktop-actions" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            {/* AI Assistant button */}
            {onOpenAi && (
              <button
                type="button"
                onClick={onOpenAi}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 14px',
                  background: 'var(--bg-subtle)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '20px',
                  color: 'var(--text-secondary)',
                  fontSize: '0.84rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseOver={(e) => { e.currentTarget.style.borderColor = 'var(--accent-primary)'; }}
                onMouseOut={(e) => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
              >
                <span>✨ AI PG Finder</span>
              </button>
            )}

            {!isLoggedIn ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Link
                  to="/login"
                  style={{
                    fontSize: '0.92rem',
                    fontWeight: '600',
                    color: 'var(--text-primary)',
                    padding: '8px 14px',
                  }}
                >
                  Log in
                </Link>
                <Link
                  to="/register"
                  className="btn-primary"
                  style={{ padding: '8px 18px', fontSize: '0.9rem' }}
                >
                  Get started
                </Link>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {/* Notification Bell with Badge */}
                <div style={{
                  position: 'relative',
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: 'var(--bg-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                }}>
                  <Bell size={18} />
                  <span style={{
                    position: 'absolute',
                    top: '-2px',
                    right: '-2px',
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    background: 'var(--accent-primary)',
                    color: '#ffffff',
                    fontSize: '0.68rem',
                    fontWeight: '700',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    2
                  </span>
                </div>

                {/* User Profile Pill */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 14px',
                  background: 'var(--bg-subtle)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '24px',
                  fontSize: '0.88rem',
                  fontWeight: '600',
                }}>
                  <User size={16} color="var(--accent-primary)" />
                  <span>{user.full_name || 'My Account'}</span>
                </div>

                <button
                  type="button"
                  onClick={handleLogout}
                  title="Sign out"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '6px',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.color = '#ef4444'; }}
                  onMouseOut={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                >
                  <LogOut size={18} />
                </button>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            type="button"
            className="nav-mobile-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              padding: '6px',
              display: 'none',
            }}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div style={{
            marginTop: '14px',
            paddingTop: '14px',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}>
            <Link to="/" style={{ fontSize: '0.95rem', fontWeight: '500', padding: '6px 0' }}>
              Discover
            </Link>
            {isLoggedIn && (
              <Link to="/tenant-dashboard" style={{ fontSize: '0.95rem', fontWeight: '500', padding: '6px 0' }}>
                My Bookings
              </Link>
            )}
            {isOwner && (
              <Link to="/owner-dashboard" style={{ fontSize: '0.95rem', fontWeight: '500', padding: '6px 0' }}>
                Owner Portal
              </Link>
            )}

            {!isLoggedIn ? (
              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <Link to="/login" className="btn-secondary" style={{ flex: 1, padding: '10px', textAlign: 'center' }}>
                  Log in
                </Link>
                <Link to="/register" className="btn-primary" style={{ flex: 1, padding: '10px', textAlign: 'center' }}>
                  Get started
                </Link>
              </div>
            ) : (
              <button onClick={handleLogout} className="btn-secondary" style={{ width: '100%', marginTop: '8px', gap: '6px' }}>
                <LogOut size={16} />
                <span>Sign Out ({user.full_name})</span>
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
