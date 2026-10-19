import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle2, Bed, MapPin, Calendar, ArrowRight, Printer } from 'lucide-react';
import { api } from '../api';

export default function BookingSuccess() {
  const [searchParams] = useSearchParams();
  const bookingId = searchParams.get('booking_id');
  const sessionId = searchParams.get('session_id');

  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function confirmAndLoad() {
      if (!bookingId) {
        setLoading(false);
        return;
      }
      try {
        // Auto-confirm test/live payment
        const confRes = await api.confirmTestPayment({ booking_id: bookingId }).catch(() => null);
        const data = await api.getBooking(bookingId);
        setBooking(data);
      } catch (err) {
        console.error('Failed to confirm booking:', err);
      } finally {
        setLoading(false);
      }
    }
    confirmAndLoad();
  }, [bookingId]);

  return (
    <div className="container" style={{ padding: '60px 20px', maxWidth: '680px' }}>
      <div style={{
        padding: '48px 36px',
        textAlign: 'center',
        background: '#ffffff',
        borderRadius: '16px',
        border: '1px solid var(--border-glass)',
        boxShadow: '0 10px 30px rgba(44, 38, 34, 0.06)',
      }}>
        
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: '#ecfdf5',
          border: '2px solid #10b981',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px auto',
        }}>
          <CheckCircle2 size={36} color="#047857" />
        </div>

        <h1 className="font-serif" style={{ fontSize: '2.2rem', marginBottom: '8px', color: 'var(--text-primary)' }}>Bed Reserved Successfully!</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginBottom: '28px' }}>
          Your token deposit has been received and your bed is locked & confirmed.
        </p>

        {booking && (
          <div style={{
            background: 'var(--bg-warm)',
            border: '1px solid var(--border-glass)',
            borderRadius: '12px',
            padding: '24px',
            textAlign: 'left',
            marginBottom: '30px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-glass)', paddingBottom: '12px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Booking Reference</span>
              <strong style={{ fontFamily: 'monospace', color: 'var(--accent-primary)' }}>{booking._id}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-glass)', paddingBottom: '12px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Residence</span>
              <strong>{booking.property_title} ({booking.property_city?.toUpperCase()})</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-glass)', paddingBottom: '12px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Allocated Bed</span>
              <strong style={{ color: '#047857' }}>Bed {booking.bed_code} ({booking.room_type})</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-glass)', paddingBottom: '12px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Check-in Date</span>
              <strong>{booking.check_in_date}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Token Deposit Paid</span>
              <strong style={{ fontSize: '1.2rem', color: 'var(--accent-primary)' }}>₹{booking.total_amount}</strong>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <button onClick={() => window.print()} className="btn-secondary" style={{ gap: '6px' }}>
            <Printer size={16} />
            <span>Print Receipt</span>
          </button>

          <Link to="/tenant-dashboard" className="btn-primary" style={{ gap: '6px' }}>
            <span>Go to My Dashboard</span>
            <ArrowRight size={16} />
          </Link>
        </div>

      </div>
    </div>
  );
}
