import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar, Bed, Clock, AlertTriangle, RefreshCw,
  CheckCircle2, XCircle, ArrowRight, ShieldCheck, MapPin, Printer
} from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

export default function TenantDashboard() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Cancellation modal state
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  // Refund retry in progress state
  const [retryingRefundId, setRetryingRefundId] = useState(null);

  useEffect(() => {
    loadBookings();
  }, []);

  async function loadBookings() {
    try {
      setLoading(true);
      const res = await api.getMyBookings();
      setBookings(res.bookings || []);
    } catch (err) {
      setError(err.message || 'Failed to load bookings');
    } finally {
      setLoading(false);
    }
  }

  const handleConfirmCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      const res = await api.cancelBooking(cancelTarget._id, { reason: cancelReason });
      alert(res.message || 'Booking cancelled.');
      setCancelTarget(null);
      setCancelReason('');
      loadBookings();
    } catch (err) {
      alert(err.message || 'Failed to cancel booking.');
    } finally {
      setCancelling(false);
    }
  };

  /**
   * CRITICAL SECURITY AUDIT RULE FROM p.md (line 114):
   * Restrict refund retry to refund_failed only (NOT refund_pending or refunded).
   */
  const handleRetryRefund = async (bookingId) => {
    setRetryingRefundId(bookingId);
    try {
      const res = await api.processRefund(bookingId);
      alert(res.message || 'Refund successfully processed.');
      loadBookings();
    } catch (err) {
      alert(err.message || 'Refund retry failed.');
    } finally {
      setRetryingRefundId(null);
    }
  };

  return (
    <div className="container" style={{ padding: '50px 24px 90px 24px', maxWidth: '1000px' }}>
      
      {/* Header matching pgbook. */}
      <div style={{ marginBottom: '36px' }}>
        <div style={{ fontSize: '0.78rem', fontWeight: '700', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '8px' }}>
          MY ACCOUNT
        </div>
        <h1 style={{ fontSize: '2.4rem', fontWeight: '800', letterSpacing: '-0.03em', marginBottom: '8px' }}>
          Your bookings
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Manage your verified bed reservations, move-in receipts, and refund claims.
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-secondary)' }}>
          Loading your reservations...
        </div>
      ) : bookings.length === 0 ? (
        <div className="clean-panel" style={{ textAlign: 'center', padding: '60px 24px' }}>
          <div style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: 'var(--accent-primary-soft)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 18px auto',
          }}>
            <Calendar size={28} color="var(--accent-primary)" />
          </div>
          <h3 style={{ fontSize: '1.3rem', fontWeight: '700', marginBottom: '8px' }}>No bookings yet</h3>
          <p style={{ color: 'var(--text-muted)', maxWidth: '440px', margin: '0 auto 24px auto', fontSize: '0.92rem' }}>
            You haven't reserved any beds yet. Explore verified student and executive residences across Jaipur & NCR.
          </p>
          <Link to="/" className="btn-primary">
            Explore Residences
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {bookings.map((b) => {
            const isConfirmed = b.status === 'confirmed';
            const isCancelled = b.status === 'cancelled';
            const statusClass = isConfirmed ? 'active' : isCancelled ? 'expired' : 'pending';

            return (
              <div
                key={b._id}
                className="clean-panel"
                style={{
                  padding: '24px 28px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  borderRadius: '14px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    {/* Status badge pill matching pgbook. */}
                    <span className={`badge-status ${statusClass}`} style={{ marginBottom: '10px' }}>
                      {b.status}
                    </span>

                    <h2 style={{ fontSize: '1.35rem', fontWeight: '700', marginBottom: '8px', color: 'var(--text-primary)' }}>
                      {b.property_title}
                    </h2>

                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px',
                      fontSize: '0.88rem',
                      color: 'var(--text-secondary)',
                      flexWrap: 'wrap',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Calendar size={15} color="var(--text-muted)" />
                        <span>Move-in: <strong>{b.check_in_date || 'Immediate'}</strong></span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Clock size={15} color="var(--text-muted)" />
                        <span>{b.months_duration || 1} month{b.months_duration > 1 ? 's' : ''}</span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Bed size={15} color="var(--accent-primary)" />
                        <span>Bed <strong>{b.bed_code}</strong> ({b.room_type})</span>
                      </div>

                      <div>
                        <strong>₹{b.total_amount?.toLocaleString('en-IN') || '8,000'}</strong> token paid
                      </div>
                    </div>
                  </div>

                  {/* Actions matching pgbook. */}
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignSelf: 'center' }}>
                    <Link
                      to={`/booking/success?booking_id=${b._id}`}
                      className="btn-secondary"
                      style={{ padding: '8px 14px', fontSize: '0.82rem', gap: '6px' }}
                    >
                      <Printer size={15} />
                      <span>View Receipt</span>
                    </Link>

                    {isConfirmed && (
                      <button
                        onClick={() => setCancelTarget(b)}
                        className="btn-secondary"
                        style={{ padding: '8px 14px', fontSize: '0.82rem', color: '#dc2626', borderColor: '#fca5a5' }}
                      >
                        Cancel Booking
                      </button>
                    )}

                    {/* Retry Refund Button */}
                    {isCancelled && b.refund_status === 'refund_failed' && (
                      <button
                        onClick={() => handleRetryRefund(b._id)}
                        disabled={retryingRefundId === b._id}
                        className="btn-primary"
                        style={{ padding: '8px 14px', fontSize: '0.82rem', gap: '6px' }}
                      >
                        <RefreshCw size={14} className={retryingRefundId === b._id ? 'animate-spin' : ''} />
                        <span>{retryingRefundId === b._id ? 'Retrying...' : 'Retry Refund'}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Refund Status Banner */}
                {isCancelled && (
                  <div style={{
                    padding: '12px 16px',
                    borderRadius: '8px',
                    background: b.refund_status === 'refunded' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.08)',
                    border: b.refund_status === 'refunded' ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(245, 158, 11, 0.25)',
                    fontSize: '0.84rem',
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '8px',
                  }}>
                    <div>
                      Refund Status: <strong style={{ color: b.refund_status === 'refunded' ? '#059669' : '#d97706', textTransform: 'capitalize' }}>
                        {b.refund_status?.replace('_', ' ')}
                      </strong> (₹{b.refund_amount})
                    </div>
                    {b.refund_reference && (
                      <span style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        Ref: {b.refund_reference}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Cancellation Modal */}
      {cancelTarget && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 220,
          background: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
        }}>
          <div className="clean-panel" style={{ maxWidth: '480px', width: '100%', padding: '30px' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '10px' }}>Confirm Cancellation</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '16px', lineHeight: 1.5 }}>
              Are you sure you want to cancel your reservation for <strong>{cancelTarget.property_title}</strong> (Bed {cancelTarget.bed_code})?
            </p>
            <div style={{
              background: 'var(--bg-subtle)',
              border: '1px solid var(--border-subtle)',
              padding: '12px 14px',
              borderRadius: '8px',
              fontSize: '0.84rem',
              color: 'var(--text-secondary)',
              marginBottom: '16px',
            }}>
              Eligible token refund: <strong>80% policy</strong> applies post-confirmation. Bed will be returned to vacant inventory.
            </div>

            <textarea
              rows={2}
              className="input-clean"
              placeholder="Reason for cancellation (optional)..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              style={{ marginBottom: '20px', resize: 'none' }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                className="btn-secondary"
                disabled={cancelling}
              >
                Keep Booking
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={cancelling}
                className="btn-primary"
                style={{ background: '#dc2626' }}
              >
                {cancelling ? 'Cancelling...' : 'Confirm Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
