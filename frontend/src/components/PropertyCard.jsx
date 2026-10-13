import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Star, ShieldCheck, Flame, Wifi, Utensils, Wind, Bed } from 'lucide-react';

export default function PropertyCard({ property }) {
  if (!property) return null;

  // Calculate available vacant beds
  let totalBeds = 0;
  let vacantBeds = 0;
  (property.rooms || []).forEach((r) => {
    (r.beds || []).forEach((b) => {
      totalBeds++;
      if (b.status === 'vacant') vacantBeds++;
    });
  });

  const cityColorMap = {
    jaipur: '#60a5fa',
    neemrana: '#a78bfa',
    behror: '#34d399',
    kotputli: '#fbbf24',
  };

  const cityColor = cityColorMap[property.city?.toLowerCase()] || '#60a5fa';

  return (
    <div className="glass-panel" style={{
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      transition: 'all 0.25s ease',
      border: property.is_boosted ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid var(--border-glass)',
      position: 'relative',
    }}>
      {/* Boosted indicator banner */}
      {property.is_boosted && (
        <div style={{
          position: 'absolute',
          top: '12px',
          left: '12px',
          zIndex: 10,
          background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
          color: '#111827',
          padding: '4px 10px',
          borderRadius: '20px',
          fontSize: '0.75rem',
          fontWeight: '800',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          boxShadow: '0 2px 10px rgba(245, 158, 11, 0.4)',
        }}>
          <Flame size={14} />
          <span>BOOSTED</span>
        </div>
      )}

      {/* Property image container */}
      <div style={{ position: 'relative', height: '210px', overflow: 'hidden' }}>
        <img
          src={property.cover_image}
          alt={property.title}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transition: 'transform 0.4s ease',
          }}
          onMouseOver={(e) => { e.currentTarget.style.transform = 'scale(1.04)'; }}
          onMouseOut={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
        />
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(11, 15, 25, 0.8) 100%)',
        }} />

        {/* City tag */}
        <div style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          background: 'rgba(11, 15, 25, 0.75)',
          backdropFilter: 'blur(8px)',
          border: `1px solid ${cityColor}55`,
          color: cityColor,
          padding: '4px 10px',
          borderRadius: '16px',
          fontSize: '0.75rem',
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}>
          {property.city}
        </div>

        {/* Vacant beds counter on image */}
        <div style={{
          position: 'absolute',
          bottom: '12px',
          left: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: vacantBeds > 0 ? 'rgba(16, 185, 129, 0.85)' : 'rgba(239, 68, 68, 0.85)',
          backdropFilter: 'blur(4px)',
          color: '#ffffff',
          padding: '4px 10px',
          borderRadius: '6px',
          fontSize: '0.78rem',
          fontWeight: '700',
        }}>
          <Bed size={14} />
          <span>{vacantBeds > 0 ? `${vacantBeds} Vacant Beds` : 'Full / Reserved'}</span>
        </div>

        {/* Rating */}
        <div style={{
          position: 'absolute',
          bottom: '12px',
          right: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          background: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(4px)',
          color: '#fbbf24',
          padding: '4px 8px',
          borderRadius: '6px',
          fontSize: '0.8rem',
          fontWeight: '700',
        }}>
          <Star size={13} fill="#fbbf24" color="#fbbf24" />
          <span>{property.rating || '4.9'}</span>
        </div>
      </div>

      {/* Content body */}
      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', flex: 1, gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
            <MapPin size={13} color="var(--accent-primary)" />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {property.area}
            </span>
          </div>

          <h3 style={{
            fontSize: '1.15rem',
            lineHeight: 1.3,
            fontWeight: '700',
            color: 'var(--text-primary)',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {property.title}
          </h3>
        </div>

        {/* Gender / sharing badges */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{
            fontSize: '0.72rem',
            fontWeight: '600',
            padding: '3px 8px',
            borderRadius: '4px',
            background: property.gender === 'female' ? 'rgba(244, 63, 94, 0.15)' : property.gender === 'male' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(16, 185, 129, 0.15)',
            color: property.gender === 'female' ? '#fb7185' : property.gender === 'male' ? '#60a5fa' : '#34d399',
            textTransform: 'capitalize',
          }}>
            {property.gender === 'male' ? 'Boys PG' : property.gender === 'female' ? 'Girls PG' : 'Co-Living'}
          </span>

          {(property.amenities || []).slice(0, 3).map((a, idx) => (
            <span key={idx} style={{
              fontSize: '0.72rem',
              padding: '3px 8px',
              borderRadius: '4px',
              background: 'rgba(255, 255, 255, 0.05)',
              color: 'var(--text-secondary)',
            }}>
              {a}
            </span>
          ))}
        </div>

        {/* Price and CTA */}
        <div style={{
          marginTop: 'auto',
          paddingTop: '14px',
          borderTop: '1px solid var(--border-glass)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Starts from</div>
            <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#60a5fa', lineHeight: 1.1 }}>
              ₹{property.monthly_rent_start}
              <span style={{ fontSize: '0.75rem', fontWeight: '500', color: 'var(--text-muted)' }}> /month</span>
            </div>
          </div>

          <Link
            to={`/properties/${property._id}`}
            className="btn-primary"
            style={{ padding: '8px 16px', fontSize: '0.85rem' }}
          >
            Select Bed
          </Link>
        </div>
      </div>
    </div>
  );
}
