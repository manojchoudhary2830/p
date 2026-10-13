import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MapPin, ArrowLeft, ShieldCheck, Star, Bed, Flame, Sparkles } from 'lucide-react';
import { api } from '../api';
import PropertyCard from '../components/PropertyCard';
import { escapeJsonLd, generateBreadcrumbSchema } from '../lib/seo';

const CITY_METADATA = {
  jaipur: {
    name: 'Jaipur',
    tagline: 'Pink City — Student Capital & IT Corridor',
    banner: 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=1400&q=80',
    description: 'Home to premier institutions like MNIT Jaipur, Rajasthan University, Manipal, and Sitapura RIICO Industrial hub. Explore air-conditioned single, double, and triple sharing student residences with home-style vegetarian buffet.',
    hubs: ['MNIT Jaipur (Malviya Nagar)', 'World Trade Park & Gaurav Tower', 'Sitapura Industrial & Educational Hub', 'Gopalpura Bypass Coaching Hub'],
    avgRent: '₹7,500 - ₹14,000 /mo',
  },
  neemrana: {
    name: 'Neemrana',
    tagline: 'Global Hub — Japanese Industrial Zone (RIICO)',
    banner: 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=1400&q=80',
    description: 'Key industrial corridor hosting over 50 Japanese multinational enterprises including Daikin, Nissin, and Havells. Premium executive PGs offering peaceful study/work environments, round-the-clock power backup, and corporate meal plans.',
    hubs: ['RIICO Japanese Zone', 'Havells / Daikin Industrial Park', 'St. Margaret Engineering College', 'Neemrana Fort Heritage Zone'],
    avgRent: '₹7,000 - ₹12,000 /mo',
  },
  behror: {
    name: 'Behror',
    tagline: 'NH-48 Golden Corridor — Educational & Industrial Center',
    banner: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1400&q=80',
    description: 'Strategically located along Delhi-Jaipur Highway. Secure women\'s and men\'s residences with female warden supervision, biometric access control, and dedicated transport connectivity to nearby colleges and RIICO industrial phases.',
    hubs: ['Government College Behror', 'RIICO Phase I & II Behror', 'Highway Transport Junction', 'Main Market & Coaching Centers'],
    avgRent: '₹5,500 - ₹8,500 /mo',
  },
  kotputli: {
    name: 'Kotputli',
    tagline: 'Fast-Growing District & Educational Hub',
    banner: 'https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?auto=format&fit=crop&w=1400&q=80',
    description: 'Key junction between Jaipur and Gurgaon. Highly economical student hostels near Lal Bahadur Shastri (LBS) College, BDM Hospital, and manufacturing clusters with attached bathrooms and optical fiber internet.',
    hubs: ['Lal Bahadur Shastri (LBS) PG College', 'Kotputli RIICO Industrial Zone', 'UltraTech / Grasim Cement Hub', 'Civil Lines / Court Road'],
    avgRent: '₹5,000 - ₹9,000 /mo',
  },
};

export default function CityLandingPage() {
  const { city } = useParams();
  const cityKey = (city || 'jaipur').toLowerCase();
  const cityInfo = CITY_METADATA[cityKey] || CITY_METADATA.jaipur;

  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [genderFilter, setGenderFilter] = useState('all');

  useEffect(() => {
    async function loadCityProperties() {
      try {
        setLoading(true);
        const res = await api.getProperties({
          city: cityKey,
          gender: genderFilter !== 'all' ? genderFilter : undefined,
        });
        setProperties(res.properties || []);
      } catch (err) {
        console.error('Failed to load city properties:', err);
      } finally {
        setLoading(false);
      }
    }
    loadCityProperties();
  }, [cityKey, genderFilter]);

  // SEO Breadcrumb schema (sanitized)
  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: 'http://localhost:3000/' },
    { name: `${cityInfo.name} PGs`, url: `http://localhost:3000/cities/${cityKey}` },
  ]);
  const sanitizedBreadcrumbs = escapeJsonLd(breadcrumbSchema);

  return (
    <div>
      {/* Breadcrumb Schema injection with XSS protection */}
      {sanitizedBreadcrumbs && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: sanitizedBreadcrumbs }}
        />
      )}

      {/* City Hero Banner */}
      <section style={{
        position: 'relative',
        minHeight: '360px',
        display: 'flex',
        alignItems: 'center',
        overflow: 'hidden',
        borderBottom: '1px solid var(--border-glass)',
      }}>
        <img
          src={cityInfo.banner}
          alt={cityInfo.name}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, rgba(11, 15, 25, 0.75) 0%, rgba(11, 15, 25, 0.95) 100%)',
        }} />

        <div className="container" style={{ position: 'relative', zIndex: 1, padding: '40px 20px' }}>
          <Link
            to="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              color: 'var(--text-secondary)',
              textDecoration: 'none',
              fontSize: '0.88rem',
              marginBottom: '16px',
            }}
          >
            <ArrowLeft size={16} /> Back to All Cities
          </Link>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <span className="badge badge-city" style={{ fontSize: '0.8rem', padding: '6px 12px' }}>
              <MapPin size={14} /> {cityInfo.name}, Rajasthan
            </span>
            <span style={{ fontSize: '0.85rem', color: '#60a5fa', fontWeight: '600' }}>
              Avg: {cityInfo.avgRent}
            </span>
          </div>

          <h1 style={{ fontSize: 'clamp(2rem, 4vw, 3.2rem)', marginBottom: '12px' }}>
            PG & Hostels in <span className="gradient-text">{cityInfo.name}</span>
          </h1>

          <p style={{ maxWidth: '720px', color: 'var(--text-secondary)', fontSize: '1.05rem', lineHeight: 1.6, marginBottom: '20px' }}>
            {cityInfo.description}
          </p>

          {/* Key Hubs */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {cityInfo.hubs.map((hub, idx) => (
              <span
                key={idx}
                style={{
                  fontSize: '0.8rem',
                  padding: '5px 12px',
                  borderRadius: '16px',
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid var(--border-glass)',
                  color: 'var(--text-primary)',
                }}
              >
                📍 {hub}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* City Properties Listing */}
      <section className="container" style={{ padding: '40px 20px 80px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ fontSize: '1.5rem' }}>Verified Residences in {cityInfo.name}</h2>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
              {properties.length} active hostels with real-time bed reservations
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {['all', 'male', 'female', 'co-ed'].map((g) => (
              <button
                key={g}
                onClick={() => setGenderFilter(g)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '16px',
                  fontSize: '0.82rem',
                  fontWeight: '600',
                  border: genderFilter === g ? '1px solid #3b82f6' : '1px solid var(--border-glass)',
                  background: genderFilter === g ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                  color: genderFilter === g ? '#60a5fa' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
              >
                {g === 'all' ? 'All Genders' : g === 'male' ? 'Boys PG' : g === 'female' ? 'Girls PG' : 'Co-Living'}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-secondary)' }}>
            Loading {cityInfo.name} accommodations...
          </div>
        ) : properties.length === 0 ? (
          <div className="glass-panel" style={{ textAlign: 'center', padding: '60px 20px' }}>
            <h3 style={{ fontSize: '1.3rem', marginBottom: '8px' }}>No properties currently found for this filter</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>
              Check out all available PG listings in {cityInfo.name} without filters.
            </p>
            <button onClick={() => setGenderFilter('all')} className="btn-secondary">
              Show All in {cityInfo.name}
            </button>
          </div>
        ) : (
          <div className="grid-cards">
            {properties.map((p) => (
              <PropertyCard key={p._id} property={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
