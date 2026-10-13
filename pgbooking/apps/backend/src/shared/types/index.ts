// ─────────────────────────────────────────────
// Domain Enums (mirror PostgreSQL ENUM types)
// ─────────────────────────────────────────────

export enum UserRole {
  TENANT = 'TENANT',
  OWNER = 'OWNER',
  SYSTEM_ADMIN = 'SYSTEM_ADMIN',
}

export enum GenderPolicy {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  CO_LIVING = 'CO_LIVING',
}

export enum BedStatus {
  VACANT = 'VACANT',
  RESERVED = 'RESERVED',
  OCCUPIED = 'OCCUPIED',
}

export enum BookingStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
  CHECKED_OUT = 'CHECKED_OUT',
}

export enum PaymentPurpose {
  TOKEN_DEPOSIT = 'TOKEN_DEPOSIT',
  MONTHLY_RENT = 'MONTHLY_RENT',
  SECURITY_DEPOSIT = 'SECURITY_DEPOSIT',
  UTILITY_ARREARS = 'UTILITY_ARREARS',
  REFUND = 'REFUND',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  SUCCESSFUL = 'SUCCESSFUL',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
  PROCESSING = 'PROCESSING',
}

export enum KycStatus {
  UNVERIFIED = 'UNVERIFIED',
  PENDING_REVIEW = 'PENDING_REVIEW',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
}

export enum KycDocumentType {
  AADHAAR = 'AADHAAR',
  PAN_CARD = 'PAN_CARD',
  PASSPORT = 'PASSPORT',
  DRIVING_LICENSE = 'DRIVING_LICENSE',
  VOTER_ID = 'VOTER_ID',
}

export enum MaintenanceStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
}

export enum MaintenanceCategory {
  PLUMBING = 'PLUMBING',
  ELECTRICAL = 'ELECTRICAL',
  FURNITURE = 'FURNITURE',
  CLEANING = 'CLEANING',
  INTERNET = 'INTERNET',
  APPLIANCE = 'APPLIANCE',
  SECURITY = 'SECURITY',
  OTHER = 'OTHER',
}

export enum NotificationType {
  OTP = 'OTP',
  BOOKING_CREATED = 'BOOKING_CREATED',
  BOOKING_CONFIRMED = 'BOOKING_CONFIRMED',
  BOOKING_CANCELLED = 'BOOKING_CANCELLED',
  PAYMENT_RECEIVED = 'PAYMENT_RECEIVED',
  PAYMENT_DUE = 'PAYMENT_DUE',
  PAYMENT_OVERDUE = 'PAYMENT_OVERDUE',
  MAINTENANCE_CREATED = 'MAINTENANCE_CREATED',
  MAINTENANCE_UPDATED = 'MAINTENANCE_UPDATED',
  KYC_APPROVED = 'KYC_APPROVED',
  KYC_REJECTED = 'KYC_REJECTED',
  PROPERTY_APPROVED = 'PROPERTY_APPROVED',
  RENT_INVOICE = 'RENT_INVOICE',
  GENERAL = 'GENERAL',
}

export enum NotificationChannel {
  PUSH = 'PUSH',
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  IN_APP = 'IN_APP',
}

export enum PropertyVerificationStatus {
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
  SUSPENDED = 'SUSPENDED',
}

export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

// ─────────────────────────────────────────────
// Domain Interfaces
// ─────────────────────────────────────────────

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: SortOrder;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export interface ApiResponse<T = unknown> {
  status: 'success' | 'error';
  message?: string;
  data?: T;
  errors?: ValidationError[];
  meta?: Record<string, unknown>;
}

export interface ValidationError {
  field: string;
  message: string;
  code?: string;
}

export interface JwtPayload {
  sub: string;         // user ID
  role: UserRole;
  phone: string;
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string | string[];
  jti?: string;        // JWT ID for revocation
}

export interface RefreshTokenPayload {
  sub: string;
  tokenFamily: string;  // for refresh token rotation
  jti: string;
}

export interface RequestUser {
  id: string;
  role: UserRole;
  phone: string;
}

// ─────────────────────────────────────────────
// Database Row Types
// ─────────────────────────────────────────────

export interface UserRow {
  id: string;
  phone_number: string;
  email_address: string | null;
  legal_full_name: string;
  account_role: UserRole;
  identity_kyc_status: KycStatus;
  is_active: boolean;
  last_login_at: Date | null;
  record_created_at: Date;
  record_updated_at: Date;
  deleted_at: Date | null;
}

export interface PropertyRow {
  id: string;
  landlord_owner_id: string;
  property_display_name: string;
  descriptive_summary: string | null;
  physical_address_line: string;
  municipality_city: string;
  geo_coordinate_point: string; // WKT format from PostGIS
  gender_segregation_policy: GenderPolicy;
  structural_amenities: string[];
  is_listing_verified_by_admin: boolean;
  verification_status: PropertyVerificationStatus;
  total_beds: number;
  vacant_beds: number;
  min_rent: number | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface RoomRow {
  id: string;
  property_parent_id: string;
  room_identifier_code: string;
  floor_level_index: number;
  max_occupancy_sharing_limit: number;
  standard_monthly_rent_amount: string; // numeric -> string from pg
  required_security_deposit_amount: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface BedRow {
  id: string;
  room_parent_id: string;
  bed_spatial_code: string;
  current_occupancy_status: BedStatus;
  last_modified_timestamp: Date;
}

export interface BookingRow {
  id: string;
  tenant_user_id: string;
  assigned_bed_id: string;
  current_booking_lifecycle_state: BookingStatus;
  scheduled_check_in_date: Date;
  scheduled_check_out_date: Date | null;
  token_fee_amount_paid: string;
  monthly_rent_amount: string;
  security_deposit_amount: string;
  lock_redis_key: string | null;
  reservation_lock_expires_at: Date | null;
  idempotency_key: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface PaymentRow {
  id: string;
  booking_context_id: string | null;
  payer_user_id: string;
  exact_financial_amount: string;
  currency_code: string;
  transaction_clearance_status: PaymentStatus;
  payment_gateway_external_id: string | null;
  payment_gateway_order_id: string | null;
  financial_payment_purpose: PaymentPurpose;
  idempotency_key: string;
  gateway_signature: string | null;
  metadata: Record<string, unknown> | null;
  transaction_timestamp: Date;
  updated_at: Date;
}

export interface MaintenanceTicketRow {
  id: string;
  booking_id: string;
  reported_by_user_id: string;
  assigned_to_owner_id: string | null;
  title: string;
  description: string;
  category: MaintenanceCategory;
  current_status: MaintenanceStatus;
  photo_urls: string[];
  resolution_notes: string | null;
  created_at: Date;
  updated_at: Date;
  resolved_at: Date | null;
}

export interface NotificationRow {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  channel: NotificationChannel;
  is_read: boolean;
  sent_at: Date | null;
  read_at: Date | null;
  created_at: Date;
}

export interface RefreshTokenRow {
  id: string;
  user_id: string;
  token_hash: string;
  token_family: string;
  expires_at: Date;
  is_revoked: boolean;
  device_info: Record<string, unknown> | null;
  created_at: Date;
}

export interface AuditLogRow {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: Date;
}

// ─────────────────────────────────────────────
// Queue Job Types
// ─────────────────────────────────────────────

export interface SendSmsJobData {
  to: string;
  message: string;
  type: string;
}

export interface SendEmailJobData {
  to: string;
  subject: string;
  templateName: string;
  variables: Record<string, unknown>;
}

export interface SendPushJobData {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export interface ReleaseReservationJobData {
  bookingId: string;
  bedId: string;
  lockKey: string;
}

export interface ProcessRentInvoiceJobData {
  bookingId: string;
  month: number;
  year: number;
}
