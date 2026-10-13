#!/usr/bin/env bash
# ─────────────────────────────────────────────
# PG Booking — AWS S3 Setup Script
# Run ONCE to create all buckets, IAM user, and policies.
#
# Prerequisites:
#   1. AWS CLI installed: https://aws.amazon.com/cli/
#   2. Configured with admin credentials: aws configure
#   3. Set ENVIRONMENT below (dev or prod)
#
# Usage:
#   chmod +x infrastructure/scripts/setup-aws-s3.sh
#   ./infrastructure/scripts/setup-aws-s3.sh prod
# ─────────────────────────────────────────────

set -euo pipefail
IFS=$'\n\t'

ENVIRONMENT="${1:-dev}"
REGION="${AWS_REGION:-ap-south-1}"
IAM_USER="pgbooking-s3-${ENVIRONMENT}"
POLICY_NAME="PGBookingS3Policy-${ENVIRONMENT}"

# Bucket names
BUCKET_KYC="pgbooking-kyc-${ENVIRONMENT}"
BUCKET_PROPS="pgbooking-properties-${ENVIRONMENT}"
BUCKET_MAINT="pgbooking-maintenance-${ENVIRONMENT}"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log()  { echo -e "${GREEN}[S3 Setup]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }

log "Setting up AWS S3 for environment: $ENVIRONMENT (region: $REGION)"
echo ""

# ── 1. Create buckets ─────────────────────────

for BUCKET in "$BUCKET_KYC" "$BUCKET_PROPS" "$BUCKET_MAINT"; do
  log "Creating bucket: $BUCKET"
  if aws s3api head-bucket --bucket "$BUCKET" 2>/dev/null; then
    warn "Bucket $BUCKET already exists — skipping"
  else
    aws s3api create-bucket \
      --bucket "$BUCKET" \
      --region "$REGION" \
      --create-bucket-configuration LocationConstraint="$REGION"
    log "✅ Created: $BUCKET"
  fi
done

# ── 2. Block ALL public access on ALL buckets ──

for BUCKET in "$BUCKET_KYC" "$BUCKET_PROPS" "$BUCKET_MAINT"; do
  log "Blocking public access on: $BUCKET"
  aws s3api put-public-access-block \
    --bucket "$BUCKET" \
    --public-access-block-configuration \
      "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
done
log "✅ Public access blocked on all buckets"

# ── 3. Enable versioning on KYC bucket ────────
#    (important: KYC docs are financial-grade — keep history)

log "Enabling versioning on KYC bucket..."
aws s3api put-bucket-versioning \
  --bucket "$BUCKET_KYC" \
  --versioning-configuration Status=Enabled
log "✅ Versioning enabled on $BUCKET_KYC"

# ── 4. Enable server-side encryption ──────────

for BUCKET in "$BUCKET_KYC" "$BUCKET_PROPS" "$BUCKET_MAINT"; do
  log "Enabling AES256 encryption on: $BUCKET"
  aws s3api put-bucket-encryption \
    --bucket "$BUCKET" \
    --server-side-encryption-configuration '{
      "Rules": [{
        "ApplyServerSideEncryptionByDefault": {
          "SSEAlgorithm": "AES256"
        },
        "BucketKeyEnabled": true
      }]
    }'
done
log "✅ AES256 encryption enabled on all buckets"

# ── 5. Lifecycle: auto-delete incomplete uploads ──

for BUCKET in "$BUCKET_KYC" "$BUCKET_PROPS" "$BUCKET_MAINT"; do
  aws s3api put-bucket-lifecycle-configuration \
    --bucket "$BUCKET" \
    --lifecycle-configuration '{
      "Rules": [{
        "ID": "CleanupIncompleteUploads",
        "Status": "Enabled",
        "Filter": { "Prefix": "" },
        "AbortIncompleteMultipartUpload": { "DaysAfterInitiation": 1 }
      }]
    }'
done
log "✅ Lifecycle rules set (abort incomplete uploads after 1 day)"

# ── 6. CORS on properties bucket ─────────────
#    (mobile app reads from this bucket directly)

log "Setting CORS on property photos bucket..."
aws s3api put-bucket-cors \
  --bucket "$BUCKET_PROPS" \
  --cors-configuration '{
    "CORSRules": [{
      "AllowedOrigins": ["*"],
      "AllowedMethods": ["GET", "HEAD"],
      "AllowedHeaders": ["*"],
      "MaxAgeSeconds": 3600
    }]
  }'
log "✅ CORS configured on $BUCKET_PROPS"

# ── 7. Create IAM user with minimal S3 permissions ──

log "Creating IAM user: $IAM_USER"
if aws iam get-user --user-name "$IAM_USER" 2>/dev/null; then
  warn "IAM user $IAM_USER already exists — skipping creation"
else
  aws iam create-user --user-name "$IAM_USER"
  log "✅ IAM user created: $IAM_USER"
fi

# ── 8. Create and attach IAM policy ──────────

log "Creating IAM policy: $POLICY_NAME"

POLICY_DOCUMENT=$(cat << JSONEOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "KYCBucketAccess",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:HeadObject"
      ],
      "Resource": "arn:aws:s3:::${BUCKET_KYC}/*"
    },
    {
      "Sid": "PropertiesBucketAccess",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:HeadObject"
      ],
      "Resource": "arn:aws:s3:::${BUCKET_PROPS}/*"
    },
    {
      "Sid": "MaintenanceBucketAccess",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:HeadObject"
      ],
      "Resource": "arn:aws:s3:::${BUCKET_MAINT}/*"
    },
    {
      "Sid": "ListBuckets",
      "Effect": "Allow",
      "Action": ["s3:ListBucket"],
      "Resource": [
        "arn:aws:s3:::${BUCKET_KYC}",
        "arn:aws:s3:::${BUCKET_PROPS}",
        "arn:aws:s3:::${BUCKET_MAINT}"
      ]
    }
  ]
}
JSONEOF
)

# Delete existing policy if it exists, then recreate
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
POLICY_ARN="arn:aws:iam::${ACCOUNT_ID}:policy/${POLICY_NAME}"

if aws iam get-policy --policy-arn "$POLICY_ARN" 2>/dev/null; then
  log "Updating existing policy..."
  POLICY_VERSION=$(aws iam list-policy-versions \
    --policy-arn "$POLICY_ARN" \
    --query 'Versions[?!IsDefaultVersion].VersionId' \
    --output text | head -1)
  [[ -n "$POLICY_VERSION" ]] && aws iam delete-policy-version --policy-arn "$POLICY_ARN" --version-id "$POLICY_VERSION"
  aws iam create-policy-version \
    --policy-arn "$POLICY_ARN" \
    --policy-document "$POLICY_DOCUMENT" \
    --set-as-default
else
  POLICY_ARN=$(aws iam create-policy \
    --policy-name "$POLICY_NAME" \
    --policy-document "$POLICY_DOCUMENT" \
    --query 'Policy.Arn' \
    --output text)
  log "✅ Policy created: $POLICY_ARN"
fi

# Attach policy to user
aws iam attach-user-policy --user-name "$IAM_USER" --policy-arn "$POLICY_ARN"
log "✅ Policy attached to user $IAM_USER"

# ── 9. Create access keys ─────────────────────

log "Creating access keys for $IAM_USER..."
KEYS=$(aws iam create-access-key --user-name "$IAM_USER" \
  --query 'AccessKey.[AccessKeyId,SecretAccessKey]' \
  --output text)

ACCESS_KEY_ID=$(echo "$KEYS" | cut -f1)
SECRET_ACCESS_KEY=$(echo "$KEYS" | cut -f2)

# ── 10. Print .env values ─────────────────────

echo ""
echo "════════════════════════════════════════════"
echo "  ✅  AWS S3 Setup Complete"
echo "════════════════════════════════════════════"
echo ""
echo "Copy these into apps/backend/.env.production:"
echo ""
echo "  AWS_REGION=${REGION}"
echo "  AWS_ACCESS_KEY_ID=${ACCESS_KEY_ID}"
echo "  AWS_SECRET_ACCESS_KEY=${SECRET_ACCESS_KEY}"
echo "  AWS_S3_BUCKET_KYC=${BUCKET_KYC}"
echo "  AWS_S3_BUCKET_PROPERTIES=${BUCKET_PROPS}"
echo "  AWS_S3_BUCKET_MAINTENANCE=${BUCKET_MAINT}"
echo "  AWS_S3_SIGNED_URL_EXPIRY_SECONDS=3600"
echo ""
echo "════════════════════════════════════════════"
echo "  ⚠️  SAVE THE SECRET KEY NOW — it won't"
echo "      be shown again by AWS."
echo "════════════════════════════════════════════"
echo ""
echo "Buckets created:"
echo "  s3://${BUCKET_KYC}         (private, versioned, AES256)"
echo "  s3://${BUCKET_PROPS}  (private, AES256, CORS for GET)"
echo "  s3://${BUCKET_MAINT}  (private, AES256)"
echo ""
echo "For local dev with LocalStack:"
echo "  AWS_ENDPOINT_URL=http://localhost:4566"
echo "  (keep fake values for the keys above in .env.development)"
