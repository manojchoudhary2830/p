import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  MapPin, Star, ShieldCheck, Flame, Bed, Wifi, Utensils, Wind,
  Clock, Lock, CheckCircle2, AlertCircle, ArrowLeft, CreditCard, Share2
} from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { escapeJsonLd, generatePropertySchema } from '../lib/seo';

export default function PropertyDetail({ onOpenAuth }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isLoggedIn } = useAuth();

  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Selected bed state
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [selectedBed, setSelectedBed] = useState(null);

  // Real-time Bed Lock state (BED_LOCK_TTL_MIN countdown)
  const [lockStatus, setLockStatus] = useState(null); // { lock_expires_at, ttl_seconds }
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [isLocking, setIsLocking] = useState(false);

  // Checkout modal
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkInDate, setCheckInDate] = useState(new Date().toISOString().split('T')[0]);
  const [bookingInProgress, setBookingInProgress] = useState(false);
  const [checkoutMessage, setCheckoutMessage] = useState('');

  useEffect(() => {
    async function fetchProperty() {
      try {
        setLoading(true);
        const data = await api.getProperty(id);
        setProperty(data);

        // Auto-select first room with vacant beds
        if (data.rooms && data.rooms.length > 0) {
          const roomWithVacant = data.rooms.find(r => (r.beds || []).some(b => b.status === 'vacant')) || data.rooms[0];
          setSelectedRoom(roomWithVacant);
          const firstVacantBed = (roomWithVacant.beds || []).find(b => b.status === 'vacant');
          if (firstVacantBed) setSelectedBed(firstVacantBed);
        }
      } catch (err) {
        setError(err.message || 'Failed to load property');
      } finally {
        setLoading(false);
      }
    }
    fetchProperty();
  }, [id]);

  // Bed lock countdown timer
  useEffect(() => {
    if (!lockStatus || secondsRemaining <= 0) return;

    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setLockStatus(null);
          alert('Bed lock session expired. Please re-lock to continue booking.');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [lockStatus, secondsRemaining]);

  const handleBedClick = (room, bed) => {
    if (bed.status !== 'vacant' && bed.bed_id !== selectedBed?.bed_id) return;
    setSelectedRoom(room);
    setSelectedBed(bed);
  };

  const handleAcquireLock = async () => {
    if (!isLoggedIn) {
      onOpenAuth('login');
      return;
    }
    if (!selectedRoom || !selectedBed) {
      alert('Please select an available bed first.');
      return;
    }

    try {
      setIsLocking(true);
      const res = await api.lockBed({
        property_id: property._id,
        room_id: selectedRoom.room_id,
        bed_id: selectedBed.bed_id,
      });

      setLockStatus(res);
      setSecondsRemaining(res.ttl_seconds || 600);
      setShowCheckout(true);
    } catch (err) {
      alert(err.message || 'Unable to lock bed. It may have just been reserved by someone else.');
    } finally {
      setIsLocking(false);
    }
  };

  const handleConfirmBookingPayment = async () => {
    setBookingInProgress(true);
    setCheckoutMessage('');

    try {
      // 1. Initiate booking record
      const initRes = await api.initiateBooking({
        property_id: property._id,
        room_id: selectedRoom.room_id,
        bed_id: selectedBed.bed_id,
        check_in_date: checkInDate,
      });

      // 2. Request Stripe Checkout Session with window.location.origin (p.md line 31)
      const origin = window.location.origin;
      const checkoutRes = await api.createCheckoutSession({
        booking_id: initRes._id,
        origin,
        success_url: `${origin}/booking/success?booking_id=${initRes._id}`,
        cancel_url: `${origin}/properties/${property._id}?cancelled=1`,
      });

      if (checkoutRes.checkout_url) {
        // Redirect to Stripe checkout or test confirmation simulator
        window.location.href = checkoutRes.checkout_url;
      }
    } catch (err) {
      setCheckoutMessage(err.message || 'Booking payment initiation failed.');
      setBookingInProgress(false);
    }
  };

  if (loading) {
    return (
      <div className="container" style={{ padding: '80px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: '1.2rem', color: 'var(--text-secondary)' }}>Loading property details...</div>
      </div>
    );
  }

  if (error || !property) {
    return (
      <div className="container" style={{ padding: '80px 20px', textAlign: 'center' }}>
        <h2 style={{ color: '#fb7185', marginBottom: '12px' }}>Property Not Found</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>{error}</p>
        <button onClick={() => navigate(-1)} className="btn-secondary">
          <ArrowLeft size={16} /> Go Back
        </button>
      </div>
    );
  }

  // Generate sanitized JSON-LD structured data (p.md security audit fix)
  const schemaData = generatePropertySchema(property);
  const sanitizedJsonLd = escapeJsonLd(schemaData);

  const tokenDepositAmount = Math.round(
    (selectedRoom?.rent || property.monthly_rent_start) * (property.token_deposit_fraction || 0.2)
  );

  return (
    <div className="container has-mobile-bottom-bar" style={{ padding: '30px 20px 80px 20px' }}>
      {/* 
        CRITICAL SECURITY AUDIT FIX (p.md lines 120-124):
        Escape </ in JSON-LD output to prevent script tag injection breakout
      */}
      {sanitizedJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: sanitizedJsonLd }}
        />
      )}

      {/* Top Breadcrumb & Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.9rem',
            cursor: 'pointer',
          }}
        >
          <ArrowLeft size={18} /> Back to Search
        </button>

        <div style={{ display: 'flex', gap: '8px' }}>
          <span className="badge badge-city">{property.city}</span>
          {property.is_boosted && <span className="badge badge-boosted"><Flame size={12} /> Featured</span>}
        </div>
      </div>

      {/* Header Info */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '2.2rem', marginBottom: '8px' }}>{property.title}</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <MapPin size={16} color="var(--accent-primary)" />
            {property.address} ({property.area})
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#fbbf24', fontWeight: '700' }}>
            <Star size={16} fill="#fbbf24" color="#fbbf24" />
            {property.rating} ({property.reviews_count} verified reviews)
          </span>
          <span style={{
            textTransform: 'capitalize',
            padding: '2px 8px',
            borderRadius: '4px',
            background: 'rgba(255,255,255,0.06)',
            fontSize: '0.8rem',
          }}>
            {property.gender === 'male' ? 'Boys PG' : property.gender === 'female' ? 'Girls PG' : 'Co-Living'}
          </span>
        </div>
      </div>

      {/* Auto-Adaptive Gallery Section */}
      <div className="adaptive-gallery-grid">
        <img
          src={property.cover_image}
          alt={property.title}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        <div className="gallery-secondary-images" style={{ display: 'grid', gridTemplateRows: '1fr 1fr', gap: '14px' }}>
          {(property.images || []).slice(1, 3).map((img, idx) => (
            <img
              key={idx}
              src={img}
              alt="Room view"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ))}
        </div>
      </div>

      {/* Main Grid: Auto-Adaptive 1-column on mobile/tablet, 2-column on monitor */}
      <div className="adaptive-detail-grid">
        
        {/* Left column: Overview, Rooms, Amenities */}
        <div>
          {/* Description */}
          <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
            <h2 style={{ fontSize: '1.3rem', marginBottom: '12px' }}>About this Residence</h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, fontSize: '0.96rem' }}>
              {property.description}
            </p>
          </div>

          {/* Interactive Room & Bed Matrix */}
          <div id="room-bed-selection" className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h2 style={{ fontSize: '1.3rem' }}>Select Room & Bed</h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Click an open bed to lock and reserve in real-time
                </p>
              </div>
              <div style={{ display: 'flex', gap: '10px', fontSize: '0.75rem' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#34d399' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
                  Vacant
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#fb7185' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f43f5e' }} />
                  Locked/Occupied
                </span>
              </div>
            </div>

            {/* Room Tabs */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', overflowX: 'auto', paddingBottom: '6px' }}>
              {(property.rooms || []).map((r) => {
                const isSelected = selectedRoom?.room_id === r.room_id;
                return (
                  <button
                    key={r.room_id}
                    onClick={() => {
                      setSelectedRoom(r);
                      const firstVacant = (r.beds || []).find(b => b.status === 'vacant');
                      if (firstVacant) setSelectedBed(firstVacant);
                    }}
                    style={{
                      padding: '10px 16px',
                      borderRadius: '10px',
                      background: isSelected ? 'rgba(59, 130, 246, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                      border: isSelected ? '1px solid #3b82f6' : '1px solid var(--border-glass)',
                      color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <div style={{ fontWeight: '700', fontSize: '0.92rem' }}>{r.room_type}</div>
                    <div style={{ fontSize: '0.78rem', color: isSelected ? '#93c5fd' : 'var(--text-muted)' }}>
                      ₹{r.rent}/mo • {r.sharing === 1 ? 'Single' : `${r.sharing} Sharing`}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Beds in Selected Room */}
            {selectedRoom && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '14px' }}>
                {(selectedRoom.beds || []).map((b) => {
                  const isSelected = selectedBed?.bed_id === b.bed_id;
                  const isVacant = b.status === 'vacant';
                  const isLocked = b.status === 'locked';
                  const isOccupied = b.status === 'occupied';

                  let statusClass = 'vacant';
                  if (isSelected) statusClass = 'selected';
                  else if (isLocked) statusClass = 'locked';
                  else if (isOccupied) statusClass = 'occupied';

                  return (
                    <div
                      key={b.bed_id}
                      onClick={() => handleBedClick(selectedRoom, b)}
                      className={`bed-item ${statusClass}`}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: '800', fontSize: '1rem' }}>Bed {b.code}</span>
                        <Bed size={16} />
                      </div>
                      <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: '700' }}>
                        {isOccupied ? 'Occupied' : isLocked ? 'Locked' : 'Available'}
                      </div>
                      {isSelected && (
                        <div style={{ fontSize: '0.7rem', color: '#60a5fa', fontWeight: '700' }}>
                          ✓ Selected
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Amenities Grid */}
          <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
            <h2 style={{ fontSize: '1.3rem', marginBottom: '16px' }}>Included Amenities</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
              {(property.amenities || []).map((a, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  <CheckCircle2 size={16} color="#10b981" />
                  <span>{a}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Rules */}
          {property.rules && property.rules.length > 0 && (
            <div className="glass-panel" style={{ padding: '24px' }}>
              <h2 style={{ fontSize: '1.3rem', marginBottom: '16px' }}>House Guidelines</h2>
              <ul style={{ paddingLeft: '20px', color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.8 }}>
                {property.rules.map((r, idx) => (
                  <li key={idx}>{r}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Right column: Sticky Checkout & Bed Lock Panel */}
        <div>
          <div className="glass-panel" style={{
            padding: '28px',
            position: 'sticky',
            top: '90px',
            background: '#111827',
          }}>
            {/* Price Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '16px' }}>
              <div>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Monthly Rent</span>
                <div style={{ fontSize: '1.8rem', fontWeight: '800', color: '#60a5fa' }}>
                  ₹{selectedRoom?.rent || property.monthly_rent_start}
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}> /month</span>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span className="badge badge-vacant">Ready to Move</span>
              </div>
            </div>

            {/* Selected Bed Summary */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '10px',
              padding: '14px',
              border: '1px solid var(--border-glass)',
              marginBottom: '20px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Selected Room:</span>
                <strong>{selectedRoom?.room_type || 'Single AC'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Bed Code:</span>
                <strong>Bed {selectedBed?.code || '101-A'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', color: '#34d399' }}>
                <span>Token Deposit (20%):</span>
                <strong>₹{tokenDepositAmount}</strong>
              </div>
            </div>

            {/* Bed Lock Active Notice (if locked) */}
            {lockStatus && secondsRemaining > 0 && (
              <div style={{
                background: 'rgba(245, 158, 11, 0.15)',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                color: '#fbbf24',
              }}>
                <Clock size={20} className="pulse-glow" />
                <div style={{ fontSize: '0.85rem' }}>
                  <strong>Bed locked for you!</strong>
                  <div>Expires in {Math.floor(secondsRemaining / 60)}m {secondsRemaining % 60}s</div>
                </div>
              </div>
            )}

            {/* Check-in Date */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                Intended Check-in Date
              </label>
              <input
                type="date"
                className="input-glass"
                value={checkInDate}
                onChange={(e) => setCheckInDate(e.target.value)}
              />
            </div>

            {/* Action Button */}
            {!lockStatus ? (
              <button
                onClick={handleAcquireLock}
                disabled={isLocking || !selectedBed}
                className="btn-primary"
                style={{ width: '100%', padding: '14px', fontSize: '1rem' }}
              >
                <Lock size={18} />
                <span>{isLocking ? 'Acquiring Bed Lock...' : 'Lock Bed & Book (₹' + tokenDepositAmount + ')'}</span>
              </button>
            ) : (
              <button
                onClick={handleConfirmBookingPayment}
                disabled={bookingInProgress}
                className="btn-primary"
                style={{ width: '100%', padding: '14px', fontSize: '1rem', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
              >
                <CreditCard size={18} />
                <span>{bookingInProgress ? 'Redirecting to Payment...' : 'Pay Token Deposit & Confirm'}</span>
              </button>
            )}

            {checkoutMessage && (
              <p style={{ marginTop: '10px', fontSize: '0.85rem', color: '#fb7185' }}>{checkoutMessage}</p>
            )}

            {/* Safety policy highlights */}
            <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-glass)', fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div>🛡️ <strong>Zero Brokerage Guarantee:</strong> Direct verified owner listing</div>
              <div>⚡ <strong>Bed Lock Guarantee:</strong> 10-minute timeout prevents double booking</div>
              <div>💸 <strong>Refund Policy:</strong> 100% refund within 2 days; 80% refund thereafter</div>
            </div>
          </div>
        </div>

      </div>

      {/* Mobile Sticky Quick Booking Bar */}
      <div className="mobile-bottom-bar">
        <div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Monthly Rent</div>
          <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#60a5fa', lineHeight: 1.1 }}>
            ₹{selectedRoom?.rent || property.monthly_rent_start}
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}> /mo</span>
          </div>
        </div>

        <button
          onClick={() => {
            if (lockStatus) {
              handleConfirmBookingPayment();
            } else {
              const bedSection = document.getElementById('room-bed-selection');
              if (bedSection) {
                bedSection.scrollIntoView({ behavior: 'smooth' });
              }
            }
          }}
          className="btn-primary"
          style={{ padding: '10px 18px', fontSize: '0.9rem' }}
        >
          {lockStatus ? 'Pay Deposit & Book' : 'Select Bed'}
        </button>
      </div>

    </div>
  );
}
