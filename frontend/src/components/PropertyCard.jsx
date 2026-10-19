import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Star, ShieldCheck, Flame, Wifi, Utensils, Wind, Bed, CheckCircle2 } from 'lucide-react';

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

  return (
    <div style={{
      background: '#ffffff',
      border: property.is_boosted ? '1px solid rgba(200, 90, 56, 0.4)' : '1px solid var(--border-subtle)',
      borderRadius: '16px',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      boxShadow: 'var(--shadow-sm)',
      transition: 'all 0.25s ease',
      position: 'relative',
    }}
      onMouseOver={(e) => {
        e.currentTarget.style.boxShadow = 'var(--shadow-md)';
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      {/* Boosted indicator banner */}
      {property.is_boosted && (
        <div style={{
          position: 'absolute',
          top: '12px',
          left: '12px',
          zIndex: 10,
          background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
          color: '#ffffff',
          padding: '4px 10px',
          borderRadius: '20px',
          fontSize: '0.72rem',
          fontWeight: '700',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          boxShadow: '0 2px 8px rgba(217, 119, 6, 0.3)',
        }}>
          <Flame size={13} />
          <span>TOP PICK</span>
        </div>
      )}

      {/* Property image container */}
      <div style={{ position: 'relative', height: '200px', overflow: 'hidden' }}>
        <img
          src={property.cover_image}
          alt={property.title}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transition: 'transform 0.4s ease',
          }}
          onMouseOver={(e) => { e.currentTarget.style.transform = 'scale(1.03)'; }}
          onMouseOut={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
        />

        {/* City tag */}
        <div style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          background: 'rgba(255, 255, 255, 0.92)',
          backdropFilter: 'blur(8px)',
          color: 'var(--text-primary)',
          padding: '4px 10px',
          borderRadius: '16px',
          fontSize: '0.75rem',
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
        }}>
          {property.city}
        </div>

        {/* Vacant beds badge */}
        <div style={{
          position: 'absolute',
          bottom: '10px',
          left: '12px',
          background: 'rgba(25, 30, 26, 0.85)',
          backdropFilter: 'blur(6px)',
          color: '#ffffff',
          padding: '4px 10px',
          borderRadius: '6px',
          fontSize: '0.75rem',
          fontWeight: '600',
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
        }}>
          <Bed size={13} color="#34d399" />
          <span>{vacantBeds} of {totalBeds} beds available</span>
        </div>
      </div>

      {/* Property Details */}
      <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '6px' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: '700', lineHeight: 1.3, color: 'var(--text-primary)' }}>
            {property.title}
          </h3>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
            fontSize: '0.85rem',
            fontWeight: '700',
            color: '#b45309',
            flexShrink: 0,
          }}>
            <Star size={14} fill="#f59e0b" color="#f59e0b" />
            <span>{property.rating || '4.8'}</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.84rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
          <MapPin size={14} color="var(--accent-primary)" />
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {property.area} • {property.gender === 'co-ed' ? 'Co-Living' : property.gender === 'male' ? 'Boys PG' : 'Girls PG'}
          </span>
        </div>

        {/* Amenities preview tags */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
          {(property.amenities || []).slice(0, 3).map((amenity, idx) => (
            <span
              key={idx}
              style={{
                fontSize: '0.72rem',
                padding: '3px 8px',
                borderRadius: '4px',
                background: 'var(--bg-subtle)',
                color: 'var(--text-secondary)',
                fontWeight: '500',
              }}
            >
              {amenity}
            </span>
          ))}
          {(property.amenities || []).length > 3 && (
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', alignSelf: 'center' }}>
              +{property.amenities.length - 3} more
            </span>
          )}
        </div>

        {/* Price & Action footer */}
        <div style={{
          marginTop: 'auto',
          paddingTop: '14px',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Starts from
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--accent-primary)' }}>
              ₹{property.monthly_rent_start?.toLocaleString('en-IN') || '6,500'}<span style={{ fontSize: '0.8rem', fontWeight: '500', color: 'var(--text-secondary)' }}>/mo</span>
            </div>
          </div>

          <Link
            to={`/properties/${property._id}`}
            className="btn-primary"
            style={{ padding: '8px 16px', fontSize: '0.85rem', textDecoration: 'none' }}
          >
            Explore Beds
          </Link>
        </div>
      </div>
    </div>
  );
}
