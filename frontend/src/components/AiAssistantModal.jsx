import React, { useState } from 'react';
import { X, Sparkles, ArrowRight, MapPin, Send } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../api';

export default function AiAssistantModal({ isOpen, onClose }) {
  const [query, setQuery] = useState('');
  const [city, setCity] = useState('');
  const [maxBudget, setMaxBudget] = useState('');
  const [gender, setGender] = useState('all');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  if (!isOpen) return null;

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setResult(null);

    try {
      const res = await api.askRecommendation({
        query,
        city: city || undefined,
        max_budget: maxBudget ? parseFloat(maxBudget) : undefined,
        gender: gender !== 'all' ? gender : undefined,
      });
      setResult(res);
    } catch (err) {
      console.error('AI recommendation failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const samplePrompts = [
    'Single AC room near MNIT Jaipur with Wi-Fi and 3 meals',
    'Executive PG in Neemrana Japanese Industrial Zone for engineer',
    'Safe girls PG in Behror with CCTV & power backup',
    'Budget student PG near LBS College Kotputli',
  ];

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 200,
      background: 'rgba(28, 25, 23, 0.65)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '640px',
        maxHeight: '90vh',
        overflowY: 'auto',
        padding: '32px',
        position: 'relative',
        background: '#ffffff',
        borderRadius: '16px',
        border: '1px solid var(--border-glass)',
        boxShadow: '0 24px 60px rgba(44, 38, 34, 0.18)',
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
            padding: '4px',
          }}
        >
          <X size={20} />
        </button>

        {/* Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: 'var(--accent-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Sparkles size={18} color="#fff" />
          </div>
          <h2 className="font-serif" style={{ fontSize: '1.6rem', color: 'var(--text-primary)' }}>AI Room Finder</h2>
        </div>
        <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
          Tell us your college, company, or preferences — our AI will find the best verified PG with vacant beds.
        </p>

        {/* Query form */}
        <form onSubmit={handleSearch} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <textarea
              rows={3}
              className="input-glass"
              placeholder="e.g. Joining Daikin in Neemrana Japanese Zone next week. Need double sharing AC room with meals under ₹8,000..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ resize: 'none' }}
            />
          </div>

          {/* Quick suggestions */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {samplePrompts.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setQuery(p)}
                style={{
                  fontSize: '0.75rem',
                  padding: '4px 10px',
                  borderRadius: '12px',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid var(--border-glass)',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                "{p}"
              </button>
            ))}
          </div>

          {/* City & Budget row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                City
              </label>
              <select
                className="input-glass"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                style={{ padding: '8px 12px', fontSize: '0.85rem' }}
              >
                <option value="">All Cities</option>
                <option value="jaipur">Jaipur</option>
                <option value="neemrana">Neemrana</option>
                <option value="behror">Behror</option>
                <option value="kotputli">Kotputli</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                Max Rent (₹)
              </label>
              <input
                type="number"
                className="input-glass"
                placeholder="e.g. 10000"
                value={maxBudget}
                onChange={(e) => setMaxBudget(e.target.value)}
                style={{ padding: '8px 12px', fontSize: '0.85rem' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                Gender
              </label>
              <select
                className="input-glass"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                style={{ padding: '8px 12px', fontSize: '0.85rem' }}
              >
                <option value="all">Any</option>
                <option value="male">Boys Only</option>
                <option value="female">Girls Only</option>
                <option value="co-ed">Co-ed</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="btn-primary"
            style={{ width: '100%', gap: '8px' }}
          >
            {loading ? <Sparkles size={18} className="pulse-glow" /> : <Send size={18} />}
            <span>{loading ? 'Finding Best Matches...' : 'Get Recommendations'}</span>
          </button>
        </form>

        {/* Results */}
        {result && (
          <div style={{ marginTop: '24px', borderTop: '1px solid var(--border-glass)', paddingTop: '20px' }}>
            <div style={{
              background: '#fef3c7',
              border: '1px solid #fde68a',
              borderRadius: '10px',
              padding: '14px',
              marginBottom: '16px',
              fontSize: '0.9rem',
              color: '#92400e',
              lineHeight: 1.5,
            }}>
              💡 <strong>AI Recommendation Insight:</strong> {result.advice}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {result.matched_properties?.map((p) => (
                <div
                  key={p._id}
                  style={{
                    display: 'flex',
                    gap: '14px',
                    padding: '14px',
                    borderRadius: '12px',
                    background: 'var(--bg-warm)',
                    border: '1px solid var(--border-glass)',
                  }}
                >
                  <img
                    src={p.cover_image}
                    alt={p.title}
                    style={{ width: '90px', height: '70px', borderRadius: '8px', objectFit: 'cover' }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                      <span className="badge badge-city" style={{ fontSize: '0.65rem' }}>{p.city}</span>
                      {p.is_boosted && <span className="badge badge-boosted" style={{ fontSize: '0.65rem' }}>Featured</span>}
                    </div>
                    <div style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p.title}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', margin: '2px 0 6px 0' }}>
                      <MapPin size={12} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.area}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: '0.95rem', fontWeight: '800', color: 'var(--accent-primary)' }}>
                        ₹{p.monthly_rent_start}<span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>/mo</span>
                      </div>
                      <Link
                        to={`/properties/${p._id}`}
                        onClick={onClose}
                        style={{
                          fontSize: '0.82rem',
                          fontWeight: '600',
                          color: 'var(--accent-primary)',
                          textDecoration: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        View Beds <ArrowRight size={14} />
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
