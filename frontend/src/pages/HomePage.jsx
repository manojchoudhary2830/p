import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Search, MapPin, Sparkles, ShieldCheck,
  CheckCircle2, ArrowRight, Bed, Building2, Star, Users
} from 'lucide-react';
import { api } from '../api';
import PropertyCard from '../components/PropertyCard';

export default function HomePage({ onOpenAi }) {
  const [properties, setProperties] = useState([]);
  const [citiesStats, setCitiesStats] = useState({});
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [genderFilter, setGenderFilter] = useState('all');
  const [sharingFilter, setSharingFilter] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [propRes, statsRes] = await Promise.allSettled([
          api.getProperties({
            search: search || undefined,
            city: cityFilter || undefined,
            gender: genderFilter !== 'all' ? genderFilter : undefined,
            sharing: sharingFilter || undefined,
          }),
          api.getCitiesStats(),
        ]);

        if (propRes.status === 'fulfilled' && propRes.value) {
          setProperties(propRes.value.properties || []);
        }
        if (statsRes.status === 'fulfilled' && statsRes.value) {
          setCitiesStats(statsRes.value || {});
        }
      } catch (err) {
        console.error('Failed to load listings:', err);
      } finally {
        setLoading(false);
      }
    }

    const timer = setTimeout(loadData, 200);
    return () => clearTimeout(timer);
  }, [search, cityFilter, genderFilter, sharingFilter]);

  const citiesList = [
    {
      id: 'jaipur',
      name: 'Jaipur',
      desc: 'MNIT, WTP, Malviya Nagar & Sitapura tech corridor',
      count: citiesStats.jaipur?.property_count || 2,
      min: citiesStats.jaipur?.starting_price || 6500,
      img: 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=600&q=80',
    },
    {
      id: 'neemrana',
      name: 'Neemrana',
      desc: 'Japanese Industrial Zone & St. Margaret Engineering College',
      count: citiesStats.neemrana?.property_count || 1,
      min: citiesStats.neemrana?.starting_price || 7500,
      img: 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=600&q=80',
    },
    {
      id: 'behror',
      name: 'Behror',
      desc: 'NH-48 Golden Corridor & Govt College',
      count: citiesStats.behror?.property_count || 1,
      min: citiesStats.behror?.starting_price || 5500,
      img: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=600&q=80',
    },
    {
      id: 'kotputli',
      name: 'Kotputli',
      desc: 'LBS College & RIICO Industrial Hub',
      count: citiesStats.kotputli?.property_count || 1,
      min: citiesStats.kotputli?.starting_price || 5000,
      img: 'https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?auto=format&fit=crop&w=600&q=80',
    },
  ];

  return (
    <div>
      {/* ──────────────────────────────────────────────────────────
         Hero Section matching pgbook.
      ────────────────────────────────────────────────────────── */}
      <section style={{
        position: 'relative',
        padding: '100px 0 90px 0',
        overflow: 'hidden',
        color: '#ffffff',
      }}>
        {/* Warm hero background photo with dark overlay */}
        <img
          src="https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=1600&q=80"
          alt="pgbook background"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, rgba(20, 24, 21, 0.72) 0%, rgba(20, 24, 21, 0.88) 100%)',
        }} />

        <div className="container" style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
          
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 16px',
            borderRadius: '20px',
            background: 'rgba(255, 255, 255, 0.12)',
            backdropFilter: 'blur(8px)',
            color: '#f9fafb',
            fontSize: '0.82rem',
            fontWeight: '600',
            letterSpacing: '0.04em',
            marginBottom: '22px',
          }}>
            <span>✨ INDIA'S GROWN-UP PG PLATFORM</span>
          </div>

          <h1 style={{
            fontSize: 'clamp(2.5rem, 5.5vw, 4.2rem)',
            lineHeight: 1.12,
            marginBottom: '20px',
            maxWidth: '900px',
            margin: '0 auto 20px auto',
            color: '#ffffff',
            fontWeight: '800',
            letterSpacing: '-0.03em',
          }}>
            Find a room that feels like <span style={{ color: '#e07a5f' }}>home.</span>
          </h1>

          <p style={{
            fontSize: '1.15rem',
            color: 'rgba(255, 255, 255, 0.88)',
            maxWidth: '680px',
            margin: '0 auto 40px auto',
            lineHeight: 1.6,
          }}>
            Verified PGs, transparent pricing, and instant booking. From working professionals to students — we've got a bed with your name on it.
          </p>

          {/* Integrated Search Bar Container */}
          <div style={{
            maxWidth: '860px',
            margin: '0 auto',
            background: '#ffffff',
            borderRadius: '12px',
            padding: '8px 12px',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            flexWrap: 'wrap',
          }}>
            {/* Search Input */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 200px', padding: '6px 10px' }}>
              <Search size={18} color="var(--text-muted)" />
              <input
                type="text"
                placeholder="Search college, area, or landmark..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  border: 'none',
                  outline: 'none',
                  width: '100%',
                  fontSize: '0.92rem',
                  color: 'var(--text-primary)',
                  background: 'transparent',
                }}
              />
            </div>

            {/* City Selector */}
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              style={{
                border: 'none',
                outline: 'none',
                background: 'var(--bg-subtle)',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '0.88rem',
                color: 'var(--text-primary)',
                fontWeight: '500',
                cursor: 'pointer',
              }}
            >
              <option value="">All Locations</option>
              <option value="jaipur">Jaipur</option>
              <option value="neemrana">Neemrana</option>
              <option value="behror">Behror</option>
              <option value="kotputli">Kotputli</option>
            </select>

            {/* Gender Selector */}
            <select
              value={genderFilter}
              onChange={(e) => setGenderFilter(e.target.value)}
              style={{
                border: 'none',
                outline: 'none',
                background: 'var(--bg-subtle)',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '0.88rem',
                color: 'var(--text-primary)',
                fontWeight: '500',
                cursor: 'pointer',
              }}
            >
              <option value="all">Any Gender</option>
              <option value="male">Boys Only</option>
              <option value="female">Girls Only</option>
              <option value="co-ed">Co-Living</option>
            </select>

            {/* Search / AI Button */}
            <button
              type="button"
              onClick={onOpenAi}
              className="btn-primary"
              style={{ padding: '10px 20px', fontSize: '0.9rem', gap: '6px' }}
            >
              <Sparkles size={16} />
              <span>Find Beds</span>
            </button>
          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────────────────────
         Stat Numbers Strip matching pgbook.
      ────────────────────────────────────────────────────────── */}
      <section style={{
        background: '#ffffff',
        borderBottom: '1px solid var(--border-subtle)',
        padding: '36px 0',
      }}>
        <div className="container" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '24px',
          textAlign: 'center',
        }}>
          <div>
            <div style={{ fontSize: '2.2rem', fontWeight: '800', color: 'var(--accent-primary)', lineHeight: 1 }}>500+</div>
            <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', letterSpacing: '0.08em', marginTop: '6px' }}>
              VERIFIED PGS
            </div>
          </div>

          <div>
            <div style={{ fontSize: '2.2rem', fontWeight: '800', color: 'var(--text-primary)', lineHeight: 1 }}>12</div>
            <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', letterSpacing: '0.08em', marginTop: '6px' }}>
              CITIES
            </div>
          </div>

          <div>
            <div style={{ fontSize: '2.2rem', fontWeight: '800', color: 'var(--accent-primary)', lineHeight: 1 }}>10k+</div>
            <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', letterSpacing: '0.08em', marginTop: '6px' }}>
              HAPPY TENANTS
            </div>
          </div>

          <div>
            <div style={{ fontSize: '2.2rem', fontWeight: '800', color: 'var(--text-primary)', lineHeight: 1 }}>4.6★</div>
            <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', letterSpacing: '0.08em', marginTop: '6px' }}>
              AVERAGE RATING
            </div>
          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────────────────────
         "NOW SERVING RAJASTHAN" -> Live where the work is
      ────────────────────────────────────────────────────────── */}
      <section className="container" style={{ padding: '60px 24px 40px 24px' }}>
        <div style={{ marginBottom: '32px' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: '700', letterSpacing: '0.1em', color: 'var(--accent-primary)', marginBottom: '8px' }}>
            NOW SERVING RAJASTHAN
          </div>
          <h2 style={{ fontSize: '2.2rem', fontWeight: '800', marginBottom: '8px' }}>
            Live where the <span style={{ color: 'var(--accent-primary)' }}>work is.</span>
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', maxWidth: '640px' }}>
            From Jaipur's IT corridor to the Japanese zone at Neemrana and highway townships at Behror and Kotputli — find a bed close to the office.
          </p>
        </div>

        <div className="adaptive-cities-grid">
          {citiesList.map((city) => (
            <Link
              key={city.id}
              to={`/cities/${city.id}`}
              style={{
                position: 'relative',
                height: '240px',
                borderRadius: '16px',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                padding: '20px',
                border: '1px solid var(--border-subtle)',
                boxShadow: 'var(--shadow-sm)',
                transition: 'all 0.3s ease',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-3px)';
                e.currentTarget.style.boxShadow = 'var(--shadow-md)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
              }}
            >
              <img
                src={city.img}
                alt={city.name}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <div style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(180deg, rgba(20,24,21,0.1) 0%, rgba(20, 24, 21, 0.88) 85%)',
              }} />
              <div style={{ position: 'relative', zIndex: 1, color: '#ffffff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <h3 style={{ fontSize: '1.35rem', color: '#ffffff' }}>{city.name}</h3>
                  <span style={{ fontSize: '0.8rem', color: '#f3a286', fontWeight: '700' }}>
                    Starts ₹{city.min}/mo
                  </span>
                </div>
                <p style={{ fontSize: '0.82rem', color: 'rgba(255, 255, 255, 0.82)', marginBottom: '8px', lineHeight: 1.3 }}>
                  {city.desc}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', color: '#ffffff', fontWeight: '600' }}>
                  <span>{city.count} Verified Residences</span>
                  <ArrowRight size={14} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ──────────────────────────────────────────────────────────
         Available Accommodations Grid
      ────────────────────────────────────────────────────────── */}
      <section className="container" style={{ padding: '20px 24px 80px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '14px' }}>
          <div>
            <h2 style={{ fontSize: '1.9rem', fontWeight: '800' }}>Featured PG Listings</h2>
            <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)' }}>
              Showing {properties.length} verified residences ready for immediate move-in
            </p>
          </div>

          {/* Quick city filter pills */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {['', 'jaipur', 'neemrana', 'behror', 'kotputli'].map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCityFilter(c)}
                style={{
                  padding: '7px 16px',
                  borderRadius: '20px',
                  fontSize: '0.82rem',
                  fontWeight: cityFilter === c ? '700' : '500',
                  background: cityFilter === c ? 'var(--accent-primary)' : '#ffffff',
                  color: cityFilter === c ? '#ffffff' : 'var(--text-secondary)',
                  border: cityFilter === c ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {c === '' ? 'All Hubs' : c.charAt(0).toUpperCase() + c.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-secondary)' }}>
            Loading properties...
          </div>
        ) : properties.length === 0 ? (
          <div className="clean-panel" style={{ textAlign: 'center', padding: '60px 20px' }}>
            <h3 style={{ fontSize: '1.3rem', marginBottom: '8px' }}>No properties found</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>
              Try adjusting your search criteria or clearing filters.
            </p>
            <button onClick={() => { setSearch(''); setCityFilter(''); setGenderFilter('all'); setSharingFilter(''); }} className="btn-secondary">
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid-cards">
            {properties.map((property) => (
              <PropertyCard key={property._id} property={property} />
            ))}
          </div>
        )}
      </section>

      {/* ──────────────────────────────────────────────────────────
         The pgbook Guarantee Strip
      ────────────────────────────────────────────────────────── */}
      <section style={{
        background: '#ffffff',
        borderTop: '1px solid var(--border-subtle)',
        borderBottom: '1px solid var(--border-subtle)',
        padding: '50px 0',
      }}>
        <div className="container adaptive-cities-grid">
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '10px',
              background: 'var(--accent-primary-soft)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Bed size={22} color="var(--accent-primary)" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: '700', marginBottom: '4px' }}>10-Minute Bed Lock</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Locks your chosen bed atomically so no other applicant can claim it while you review and checkout.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '10px',
              background: 'var(--accent-primary-soft)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <ShieldCheck size={22} color="var(--accent-primary)" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: '700', marginBottom: '4px' }}>100% Deposit Protection</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Full token refund if cancelled within 2 days. 80% refund policy post confirmation.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '10px',
              background: 'var(--accent-primary-soft)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Building2 size={22} color="var(--accent-primary)" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: '700', marginBottom: '4px' }}>Zero Brokerage Direct</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Direct owner pricing without middlemen fees, hidden deposits, or markup commissions.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
