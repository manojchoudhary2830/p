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
      background: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
    }}>
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: '640px',
        maxHeight: '90vh',
        overflowY: 'auto',
        padding: '30px',
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

        {/* Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Sparkles size={18} color="#fff" />
          </div>
          <h2 style={{ fontSize: '1.4rem' }}>NextGen AI PG Assistant</h2>
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
              background: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.25)',
              borderRadius: '10px',
              padding: '14px',
              marginBottom: '16px',
              fontSize: '0.9rem',
              color: '#93c5fd',
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
                    padding: '12px',
                    borderRadius: '10px',
                    background: 'rgba(255, 255, 255, 0.03)',
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
                    <div style={{ fontWeight: '700', fontSize: '0.92rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p.title}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', margin: '2px 0 6px 0' }}>
                      <MapPin size={12} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.area}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: '0.88rem', fontWeight: '800', color: '#60a5fa' }}>
                        ₹{p.monthly_rent_start}<span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>/mo</span>
                      </div>
                      <Link
                        to={`/properties/${p._id}`}
                        onClick={onClose}
                        style={{
                          fontSize: '0.78rem',
                          fontWeight: '600',
                          color: '#fff',
                          textDecoration: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        View Beds <ArrowRight size={12} />
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
