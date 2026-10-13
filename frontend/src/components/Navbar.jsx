import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Home, Sparkles, MapPin, User, LogOut, PlusCircle, ShieldCheck, BookmarkCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Navbar({ onOpenAuth, onOpenAi }) {
  const { user, isLoggedIn, isOwner, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

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
      background: 'rgba(11, 15, 25, 0.85)',
      backdropFilter: 'blur(20px)',
      borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
      padding: '14px 0',
    }}>
      <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px' }}>
        
        {/* Brand */}
        <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 16px rgba(59, 130, 246, 0.5)',
          }}>
            <Home size={22} color="#ffffff" />
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', fontWeight: '800', lineHeight: 1.1 }}>
              <span style={{ color: '#ffffff' }}>Next</span><span className="gradient-text">Gen PG</span>
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
              JAIPUR • NEEMRANA • BEHROR • KOTPUTLI
            </div>
          </div>
        </Link>

        {/* City Navigation */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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

      </div>
    </header>
  );
}
