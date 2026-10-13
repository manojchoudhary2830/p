import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Search, MapPin, Sparkles, SlidersHorizontal, ShieldCheck,
  CheckCircle2, ArrowRight, Flame, Users, Bed, Building2
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

        if (propRes.status === 'fulfilled') {
          setProperties(propRes.value.properties || []);
        }
        if (statsRes.status === 'fulfilled') {
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
    { id: 'jaipur', name: 'Jaipur', desc: 'MNIT, WTP, Malviya Nagar & Sitapura', count: citiesStats.jaipur?.property_count || 1, min: citiesStats.jaipur?.starting_price || 6500, img: 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=600&q=80' },
    { id: 'neemrana', name: 'Neemrana', desc: 'Japanese Industrial Zone & St. Margaret', count: citiesStats.neemrana?.property_count || 1, min: citiesStats.neemrana?.starting_price || 7500, img: 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=600&q=80' },
    { id: 'behror', name: 'Behror', desc: 'NH-48 Corridor & Govt College', count: citiesStats.behror?.property_count || 1, min: citiesStats.behror?.starting_price || 5500, img: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=600&q=80' },
    { id: 'kotputli', name: 'Kotputli', desc: 'LBS College & Industrial Hub', count: citiesStats.kotputli?.property_count || 1, min: citiesStats.kotputli?.starting_price || 5000, img: 'https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?auto=format&fit=crop&w=600&q=80' },
  ];

  return (
    <div>
      {/* ──────────────────────────────────────────────────────────
         Hero Section
      ────────────────────────────────────────────────────────── */}
      <section style={{
        position: 'relative',
        padding: '70px 0 60px 0',
        overflow: 'hidden',
        borderBottom: '1px solid var(--border-glass)',
      }}>
        <div className="container" style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
          
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 16px',
            borderRadius: '20px',
            background: 'rgba(59, 130, 246, 0.15)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            color: '#60a5fa',
            fontSize: '0.85rem',
            fontWeight: '600',
            marginBottom: '20px',
          }}>
            <ShieldCheck size={16} />
            <span>Zero Brokerage • Live Bed Lock • Verified Deposits</span>
          </div>

          <h1 style={{
            fontSize: 'clamp(2.4rem, 5vw, 4rem)',
            lineHeight: 1.15,
            marginBottom: '18px',
            maxWidth: '900px',
            margin: '0 auto 18px auto',
          }}>
            Find Your Next Home in <span className="gradient-text">Jaipur, Neemrana, Behror & Kotputli</span>
          </h1>

          <p style={{
            fontSize: '1.15rem',
            color: 'var(--text-secondary)',
            maxWidth: '680px',
            margin: '0 auto 36px auto',
            lineHeight: 1.6,
          }}>
            Modern student hostels and executive accommodations with real-time bed reservations, hygienic meals, high-speed Wi-Fi, and 100% deposit protection.
          </p>

          {/* Search Bar Container */}
          <div className="glass-panel adaptive-search-bar" style={{
            maxWidth: '860px',
            margin: '0 auto',
            padding: '10px 14px',
          }}>
            {/* Search Input */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 240px', padding: '6px 12px' }}>
              <Search size={20} color="var(--accent-primary)" />
              <input
                type="text"
                className="input-glass"
                placeholder="Search colleges, landmarks, areas (e.g. MNIT, RIICO, Malviya Nagar)..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ border: 'none', background: 'transparent', padding: '6px' }}
              />
            </div>

            {/* City Selector */}
            <select
              className="input-glass"
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              style={{ width: 'auto', flex: '0 1 140px', padding: '8px 12px', fontSize: '0.9rem' }}
            >
              <option value="">All 4 Cities</option>
              <option value="jaipur">Jaipur</option>
              <option value="neemrana">Neemrana</option>
              <option value="behror">Behror</option>
              <option value="kotputli">Kotputli</option>
            </select>

            {/* Gender Selector */}
            <select
              className="input-glass"
              value={genderFilter}
              onChange={(e) => setGenderFilter(e.target.value)}
              style={{ width: 'auto', flex: '0 1 130px', padding: '8px 12px', fontSize: '0.9rem' }}
            >
              <option value="all">Any Gender</option>
              <option value="male">Boys Only</option>
              <option value="female">Girls Only</option>
              <option value="co-ed">Co-Living</option>
            </select>

            {/* AI Assistant Quick Trigger */}
            <button
              onClick={onOpenAi}
              className="btn-primary"
              style={{ padding: '10px 18px', fontSize: '0.9rem', gap: '6px' }}
            >
              <Sparkles size={16} />
              <span>AI Search</span>
            </button>
          </div>

          {/* Quick Filter Chips */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '20px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', alignSelf: 'center' }}>Popular filters:</span>
            {[
              { label: 'Single AC Rooms', key: 'sharing', val: '1' },
              { label: 'Double Sharing', key: 'sharing', val: '2' },
              { label: 'Near Colleges', key: 'q', val: 'college' },
              { label: 'Industrial Zone', key: 'q', val: 'riico' },
            ].map((chip, idx) => (
              <button
                key={idx}
                onClick={() => {
                  if (chip.key === 'sharing') setSharingFilter(sharingFilter === chip.val ? '' : chip.val);
                  if (chip.key === 'q') setSearch(search === chip.val ? '' : chip.val);
                }}
                style={{
                  fontSize: '0.78rem',
                  padding: '4px 12px',
                  borderRadius: '16px',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid var(--border-glass)',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {chip.label}
              </button>
            ))}
          </div>

        </div>
      </section>

      {/* ──────────────────────────────────────────────────────────
         Core Cities Showcase (Jaipur, Neemrana, Behror, Kotputli)
      ────────────────────────────────────────────────────────── */}
      <section className="container" style={{ padding: '60px 20px 40px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '28px' }}>
          <div>
            <div style={{ fontSize: '0.82rem', fontWeight: '700', color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Explore Locations
            </div>
            <h2 style={{ fontSize: '1.8rem' }}>Top PG Hubs Across Rajasthan & NCR</h2>
          </div>
        </div>

        <div className="adaptive-cities-grid">
          {citiesList.map((city) => (
            <Link
              key={city.id}
              to={`/cities/${city.id}`}
              style={{
                textDecoration: 'none',
                position: 'relative',
                height: '240px',
                borderRadius: '16px',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                padding: '20px',
                border: '1px solid var(--border-glass)',
                boxShadow: 'var(--shadow-sm)',
                transition: 'all 0.3s ease',
              }}
              onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)'; }}
              onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'var(--border-glass)'; }}
            >
              <img
                src={city.img}
                alt={city.name}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <div style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(11, 15, 25, 0.9) 85%)',
              }} />
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <h3 style={{ fontSize: '1.35rem', color: '#ffffff' }}>{city.name}</h3>
                  <span style={{ fontSize: '0.78rem', color: '#60a5fa', fontWeight: '700' }}>
                    Starts ₹{city.min}/mo
                  </span>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '8px', lineHeight: 1.3 }}>
                  {city.desc}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', color: '#ffffff', fontWeight: '600' }}>
                  <span>{city.count} Verified Residences</span>
                  <ArrowRight size={14} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ──────────────────────────────────────────────────────────
         Properties Grid
      ────────────────────────────────────────────────────────── */}
      <section className="container" style={{ padding: '30px 20px 80px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '14px' }}>
          <div>
            <h2 style={{ fontSize: '1.8rem' }}>Available Accommodations</h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              Showing {properties.length} verified PG residences ready for immediate move-in
            </p>
          </div>

          {/* Quick city pill toggles */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {['', 'jaipur', 'neemrana', 'behror', 'kotputli'].map((c) => (
              <button
                key={c}
                onClick={() => setCityFilter(c)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  fontSize: '0.82rem',
                  fontWeight: '600',
                  border: cityFilter === c ? '1px solid #3b82f6' : '1px solid var(--border-glass)',
                  background: cityFilter === c ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                  color: cityFilter === c ? '#60a5fa' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
              >
                {c === '' ? 'All Locations' : c}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-secondary)' }}>
            Loading properties...
          </div>
        ) : properties.length === 0 ? (
          <div className="glass-panel" style={{ textAlign: 'center', padding: '60px 20px' }}>
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
         NextGen Trust & Policy Guarantee
      ────────────────────────────────────────────────────────── */}
      <section style={{
        background: 'rgba(15, 23, 42, 0.65)',
        borderTop: '1px solid var(--border-glass)',
        borderBottom: '1px solid var(--border-glass)',
        padding: '60px 0',
      }}>
        <div className="container adaptive-cities-grid">
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: 'rgba(59, 130, 246, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Bed size={24} color="#60a5fa" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '6px' }}>10-Minute Real-Time Bed Lock</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Locks your chosen bed atomically so no other applicant can claim it while you review and checkout.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: 'rgba(16, 185, 129, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <ShieldCheck size={24} color="#34d399" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '6px' }}>Zero Brokerage Direct Listings</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Connect directly with verified owners of residences in Jaipur, Neemrana, Behror, and Kotputli.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: 'rgba(245, 158, 11, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Flame size={24} color="#fbbf24" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '6px' }}>Transparent Refund Guarantee</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                100% refund within the 2-day grace window; 80% automated refund thereafter. No dispute hassles.
              </p>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
