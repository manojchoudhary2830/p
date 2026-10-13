import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Home, Sparkles, MapPin, User, LogOut, PlusCircle, ShieldCheck, BookmarkCheck, Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Navbar({ onOpenAuth, onOpenAi }) {
  const { user, isLoggedIn, isOwner, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile menu whenever location changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const cities = [
    { id: 'jaipur', label: 'Jaipur' },
    { id: 'neemrana', label: 'Neemrana' },
    { id: 'behror', label: 'Behror' },
    { id: 'kotputli', label: 'Kotputli' },
  ];

  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 100,
      background: 'rgba(11, 15, 25, 0.90)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
      padding: '12px 0',
    }}>
      <div className="container">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          
          {/* Brand */}
          <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 16px rgba(59, 130, 246, 0.5)',
              flexShrink: 0,
            }}>
              <Home size={22} color="#ffffff" />
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', fontWeight: '800', lineHeight: 1.1 }}>
                <span style={{ color: '#ffffff' }}>Next</span><span className="gradient-text">Gen PG</span>
              </div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
                JAIPUR • NEEMRANA • BEHROR • KOTPUTLI
              </div>
            </div>
          </Link>

          {/* Desktop City Navigation */}
          <nav className="nav-desktop-links" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {cities.map((city) => {
              const isActive = location.pathname === `/cities/${city.id}`;
              return (
                <Link
                  key={city.id}
                  to={`/cities/${city.id}`}
                  style={{
                    textDecoration: 'none',
                    fontSize: '0.88rem',
                    fontWeight: '600',
                    padding: '6px 14px',
                    borderRadius: '20px',
                    transition: 'all 0.2s',
                    background: isActive ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                    color: isActive ? '#60a5fa' : 'var(--text-secondary)',
                    border: isActive ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid transparent',
                  }}
                >
                  {city.label}
                </Link>
              );
            })}
          </nav>

          {/* Desktop Action Controls */}
          <div className="nav-desktop-actions" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* AI PG Finder button */}
            <button
              onClick={onOpenAi}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(59, 130, 246, 0.2) 100%)',
                border: '1px solid rgba(139, 92, 246, 0.4)',
                borderRadius: '20px',
                color: '#c084fc',
                fontSize: '0.85rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <Sparkles size={16} />
              <span>AI PG Finder</span>
            </button>

            {isLoggedIn ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {isOwner ? (
                  <Link to="/owner-dashboard" className="btn-secondary" style={{ padding: '8px 14px', fontSize: '0.85rem' }}>
                    <PlusCircle size={16} />
                    <span>Owner Dashboard</span>
                  </Link>
                ) : (
                  <Link to="/tenant-dashboard" className="btn-secondary" style={{ padding: '8px 14px', fontSize: '0.85rem' }}>
                    <BookmarkCheck size={16} />
                    <span>My Bookings</span>
                  </Link>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    {user?.full_name?.split(' ')[0]}
                  </span>
                  <button
                    onClick={logout}
                    title="Logout"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: '6px',
                      display: 'flex',
                    }}
                  >
                    <LogOut size={18} />
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => onOpenAuth('login')}
                className="btn-primary"
                style={{ padding: '8px 18px', fontSize: '0.88rem' }}
              >
                <User size={16} />
                <span>Login / Sign Up</span>
              </button>
            )}
          </div>

          {/* Mobile & Tablet Hamburger Toggle */}
          <button
            className="nav-mobile-toggle"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>

        </div>

        {/* Mobile & Tablet Slide-down Drawer */}
        {mobileMenuOpen && (
          <div className="nav-mobile-drawer">
            {/* Quick AI search row */}
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenAi();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '12px',
                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.25) 0%, rgba(59, 130, 246, 0.25) 100%)',
                border: '1px solid rgba(139, 92, 246, 0.5)',
                borderRadius: '12px',
                color: '#c084fc',
                fontWeight: '700',
                fontSize: '0.95rem',
                cursor: 'pointer',
                width: '100%',
              }}
            >
              <Sparkles size={18} />
              <span>Ask AI PG Finder (Budget & College Matching)</span>
            </button>

            {/* City Links Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
              {cities.map((city) => {
                const isActive = location.pathname === `/cities/${city.id}`;
                return (
                  <Link
                    key={city.id}
                    to={`/cities/${city.id}`}
                    onClick={() => setMobileMenuOpen(false)}
                    style={{
                      textDecoration: 'none',
                      textAlign: 'center',
                      fontSize: '0.88rem',
                      fontWeight: '600',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      background: isActive ? 'rgba(59, 130, 246, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                      color: isActive ? '#60a5fa' : 'var(--text-primary)',
                      border: isActive ? '1px solid #3b82f6' : '1px solid var(--border-glass)',
                    }}
                  >
                    📍 {city.label}
                  </Link>
                );
              })}
            </div>

            {/* Mobile Auth & Account Actions */}
            <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {isLoggedIn ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 4px' }}>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                      Signed in as <strong style={{ color: '#ffffff' }}>{user?.full_name}</strong> ({user?.role})
                    </span>
                    <button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        logout();
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#fb7185',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                      }}
                    >
                      <LogOut size={16} /> Logout
                    </button>
                  </div>

                  {isOwner ? (
                    <Link
                      to="/owner-dashboard"
                      onClick={() => setMobileMenuOpen(false)}
                      className="btn-primary"
                      style={{ width: '100%', justifyContent: 'center' }}
                    >
                      <PlusCircle size={18} /> Owner Portal & Listings
                    </Link>
                  ) : (
                    <Link
                      to="/tenant-dashboard"
                      onClick={() => setMobileMenuOpen(false)}
                      className="btn-primary"
                      style={{ width: '100%', justifyContent: 'center' }}
                    >
                      <BookmarkCheck size={18} /> My Bookings & Receipts
                    </Link>
                  )}
                </>
              ) : (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenAuth('login');
                  }}
                  className="btn-primary"
                  style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
                >
                  <User size={18} /> Login / Sign Up
                </button>
              )}
            </div>

          </div>
        )}

      </div>
    </header>
  );
}
