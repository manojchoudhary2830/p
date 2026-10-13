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
      <div className="glass-panel" style={{ padding: '40px 32px', textAlign: 'center' }}>
        
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: 'rgba(16, 185, 129, 0.2)',
          border: '2px solid #10b981',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px auto',
        }}>
          <CheckCircle2 size={36} color="#10b981" />
        </div>

        <h1 style={{ fontSize: '2rem', marginBottom: '8px' }}>Bed Reserved Successfully!</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginBottom: '28px' }}>
          Your token deposit has been received and your bed is locked & confirmed.
        </p>

        {booking && (
          <div style={{
            background: 'rgba(255, 255, 255, 0.02)',
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
              <strong style={{ fontFamily: 'monospace', color: '#60a5fa' }}>{booking._id}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-glass)', paddingBottom: '12px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Residence</span>
              <strong>{booking.property_title} ({booking.property_city?.toUpperCase()})</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-glass)', paddingBottom: '12px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Allocated Bed</span>
              <strong style={{ color: '#34d399' }}>Bed {booking.bed_code} ({booking.room_type})</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-glass)', paddingBottom: '12px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Check-in Date</span>
              <strong>{booking.check_in_date}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Token Deposit Paid</span>
              <strong style={{ fontSize: '1.1rem', color: '#60a5fa' }}>₹{booking.total_amount}</strong>
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
