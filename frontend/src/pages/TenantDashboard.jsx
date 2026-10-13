import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  BookmarkCheck, Bed, Clock, AlertTriangle, RefreshCw,
  CheckCircle2, XCircle, ArrowRight, ShieldCheck, MapPin
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
    <div className="container" style={{ padding: '40px 20px 80px 20px' }}>
      
      {/* Header */}
      <div style={{ marginBottom: '30px' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '6px' }}>My PG Bookings & Beds</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Welcome back, {user?.full_name}. Manage your bed reservations and refund status.
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-secondary)' }}>
          Loading your reservations...
        </div>
      ) : bookings.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <BookmarkCheck size={48} color="#60a5fa" style={{ marginBottom: '16px' }} />
          <h3 style={{ fontSize: '1.3rem', marginBottom: '8px' }}>No bookings found</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
            You haven't reserved any beds yet. Explore verified residences in Jaipur, Neemrana, Behror, or Kotputli.
          </p>
          <Link to="/" className="btn-primary">
            Browse Accommodations
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {bookings.map((b) => {
            const isConfirmed = b.status === 'confirmed';
            const isCancelled = b.status === 'cancelled';
            const isPending = b.status === 'pending_payment';

            const refundStatus = b.refund_status || 'none';
            const canRetryRefund = refundStatus === 'refund_failed'; // Security rule: refund_failed only!

            return (
              <div key={b._id} className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                
                {/* Header row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span className="badge badge-city">{b.property_city}</span>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Booking ID: {b._id}</span>
                    </div>
                    <h3 style={{ fontSize: '1.3rem' }}>{b.property_title}</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      <MapPin size={14} color="var(--accent-primary)" />
                      {b.property_address}
                    </div>
                  </div>

                  {/* Booking Status Badge */}
                  <div>
                    {isConfirmed && (
                      <span className="badge badge-vacant" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircle2 size={14} /> Confirmed
                      </span>
                    )}
                    {isPending && (
                      <span className="badge badge-locked" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={14} /> Payment Pending
                      </span>
                    )}
                    {isCancelled && (
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: '20px',
                        fontSize: '0.75rem',
                        fontWeight: '700',
                        background: 'rgba(107, 114, 128, 0.2)',
                        color: 'var(--text-muted)',
                      }}>
                        Cancelled
                      </span>
                    )}
                  </div>
                </div>

                {/* Reservation Details Card */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '14px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  padding: '16px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-glass)',
                }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Reserved Bed</span>
                    <strong style={{ fontSize: '1.05rem', color: '#60a5fa' }}>Bed {b.bed_code}</strong>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{b.room_type}</div>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Check-in Date</span>
                    <strong style={{ fontSize: '0.95rem' }}>{b.check_in_date}</strong>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Duration: {b.months_duration} mo</div>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Monthly Rent</span>
                    <strong style={{ fontSize: '0.95rem' }}>₹{b.monthly_rent}</strong>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Deposit: ₹{b.security_deposit}</div>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Amount Paid</span>
                    <strong style={{ fontSize: '1.05rem', color: '#34d399' }}>₹{b.total_amount}</strong>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Status: {b.payment_status}</div>
                  </div>
                </div>

                {/* Refund Status & Actions (per p.md lines 108-118) */}
                {isCancelled && b.refund_amount > 0 && (
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    background: refundStatus === 'refunded' ? 'rgba(16, 185, 129, 0.1)' : refundStatus === 'refund_failed' ? 'rgba(244, 63, 94, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                    border: `1px solid ${refundStatus === 'refunded' ? 'rgba(16, 185, 129, 0.25)' : refundStatus === 'refund_failed' ? 'rgba(244, 63, 94, 0.25)' : 'rgba(245, 158, 11, 0.25)'}`,
                    flexWrap: 'wrap',
                    gap: '10px',
                  }}>
                    <div>
                      <span style={{ fontSize: '0.85rem', fontWeight: '700', color: refundStatus === 'refunded' ? '#34d399' : refundStatus === 'refund_failed' ? '#fb7185' : '#fbbf24' }}>
                        {refundStatus === 'refunded' && '✓ Refund Completed: ₹' + b.refund_amount}
                        {refundStatus === 'refund_pending' && '⏳ Refund In Progress: ₹' + b.refund_amount}
                        {refundStatus === 'refund_failed' && '⚠️ Refund Transfer Issue: ₹' + b.refund_amount}
                      </span>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {refundStatus === 'refunded' && `Reference: ${b.refund_reference || 'N/A'}`}
                        {refundStatus === 'refund_pending' && 'Automated settlement queued. Retries locked while pending.'}
                        {refundStatus === 'refund_failed' && 'Gateway reported an error. Click below to retry.'}
                      </div>
                    </div>

                    {/* Retry button strictly restricted to refund_failed only */}
                    {canRetryRefund && (
                      <button
                        onClick={() => handleRetryRefund(b._id)}
                        disabled={retryingRefundId === b._id}
                        className="btn-secondary"
                        style={{ padding: '6px 14px', fontSize: '0.8rem', gap: '6px' }}
                      >
                        <RefreshCw size={14} className={retryingRefundId === b._id ? 'pulse-glow' : ''} />
                        <span>{retryingRefundId === b._id ? 'Retrying...' : 'Retry Refund'}</span>
                      </button>
                    )}
                  </div>
                )}

                {/* Footer action buttons */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '8px' }}>
                  {isConfirmed && (
                    <button
                      onClick={() => setCancelTarget(b)}
                      className="btn-secondary"
                      style={{ padding: '8px 16px', fontSize: '0.85rem', color: '#fb7185', borderColor: 'rgba(244, 63, 94, 0.3)' }}
                    >
                      Cancel Reservation
                    </button>
                  )}
                  <Link
                    to={`/properties/${b.property_id}`}
                    className="btn-secondary"
                    style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                  >
                    View Residence
                  </Link>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* Cancellation Confirmation Modal */}
      {cancelTarget && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 210,
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
        }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '480px', padding: '28px', background: '#111827' }}>
            <h3 style={{ fontSize: '1.3rem', marginBottom: '8px', color: '#fb7185' }}>
              Confirm Booking Cancellation
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '16px', lineHeight: 1.5 }}>
              Are you sure you want to cancel your reservation for <strong>Bed {cancelTarget.bed_code}</strong> at <strong>{cancelTarget.property_title}</strong>?
            </p>

            <div style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--border-glass)',
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '16px',
              fontSize: '0.85rem',
              color: 'var(--text-muted)',
            }}>
              💡 <strong>Refund Policy Reminder:</strong> Cancellations within the 2-day grace period receive 100% refund. Cancellations made thereafter receive an 80% refund.
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                Reason for cancellation
              </label>
              <textarea
                rows={2}
                className="input-glass"
                placeholder="e.g. Relocating, changed college plans..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                style={{ resize: 'none' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setCancelTarget(null)} className="btn-secondary" style={{ padding: '8px 16px' }}>
                Keep Booking
              </button>
              <button
                onClick={handleConfirmCancel}
                disabled={cancelling}
                className="btn-primary"
                style={{ padding: '8px 18px', background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)' }}
              >
                {cancelling ? 'Cancelling...' : 'Confirm & Process Refund'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
