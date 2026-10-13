// ─────────────────────────────────────────────
// Date Utilities
// ─────────────────────────────────────────────

export function formatDate(
  date: string | Date,
  style: 'short' | 'medium' | 'long' = 'medium',
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '—';

  const options: Intl.DateTimeFormatOptions = {
    short:  { day: 'numeric', month: 'short' },
    medium: { day: 'numeric', month: 'short', year: 'numeric' },
    long:   { day: 'numeric', month: 'long',  year: 'numeric' },
  }[style] as Intl.DateTimeFormatOptions;

  return d.toLocaleDateString('en-IN', options);
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hrs   = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins < 1)   return 'Just now';
  if (mins < 60)  return `${mins}m ago`;
  if (hrs  < 24)  return `${hrs}h ago`;
  if (days < 7)   return `${days}d ago`;
  return formatDate(dateStr, 'short');
}

export function toISODateString(date: Date = new Date()): string {
  return date.toISOString().split('T')[0];
}

export function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

// ─────────────────────────────────────────────
// Currency Utilities
// ─────────────────────────────────────────────

export function formatINR(
  amount: number | string,
  decimals = 0,
): string {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(n)) return '₹0';
  return '₹' + n.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatINRCompact(amount: number | string): string {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(n)) return '₹0';
  if (n >= 10_00_000) return `₹${(n / 10_00_000).toFixed(1)}L`;
  if (n >= 1_000)     return `₹${(n / 1_000).toFixed(0)}k`;
  return formatINR(n);
}

/** Convert INR amount to paise for Razorpay (multiply by 100) */
export function toPaise(amountInr: number): number {
  return Math.round(amountInr * 100);
}

/** Convert paise from Razorpay to INR */
export function fromPaise(paise: number): number {
  return paise / 100;
}

// ─────────────────────────────────────────────
// Phone Utilities
// ─────────────────────────────────────────────

export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  return phone;
}

export function maskPhone(phone: string): string {
  return phone.slice(0, 3) + '****' + phone.slice(-4);
}

// ─────────────────────────────────────────────
// String Utilities
// ─────────────────────────────────────────────

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

export function titleCase(s: string): string {
  return s.split(/[\s_-]/).map(capitalize).join(' ');
}

export function truncate(s: string, maxLength: number, suffix = '…'): string {
  return s.length > maxLength ? s.slice(0, maxLength - suffix.length) + suffix : s;
}

export function pluralize(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : (plural ?? singular + 's');
}

// ─────────────────────────────────────────────
// Validation Utilities
// ─────────────────────────────────────────────

export function isValidIndianPhone(phone: string): boolean {
  return /^(\+91)?[6-9]\d{9}$/.test(phone.replace(/\s/g, ''));
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidPincode(pincode: string): boolean {
  return /^[1-9][0-9]{5}$/.test(pincode);
}

// ─────────────────────────────────────────────
// Booking Utilities
// ─────────────────────────────────────────────

export function formatBookingStatus(status: string): string {
  return status.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase());
}

export function isBookingCancellable(status: string): boolean {
  return ['PENDING', 'CONFIRMED'].includes(status);
}

export function isBookingActive(status: string): boolean {
  return ['PENDING', 'CONFIRMED'].includes(status);
}

export function lockTimeRemaining(expiresAt: string): number {
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
}

export function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
