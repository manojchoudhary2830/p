#!/usr/bin/env bash
# LocalStack S3 initialization — runs automatically when LocalStack is ready
# Creates the three S3 buckets used by the dev environment

set -e
echo "[LocalStack Init] Creating S3 buckets for PG Booking dev..."

awslocal s3 mb s3://pgbooking-kyc-dev          --region ap-south-1
awslocal s3 mb s3://pgbooking-properties-dev   --region ap-south-1
awslocal s3 mb s3://pgbooking-maintenance-dev  --region ap-south-1

# Block public access on KYC and maintenance buckets
awslocal s3api put-public-access-block \
  --bucket pgbooking-kyc-dev \
  --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

awslocal s3api put-public-access-block \
  --bucket pgbooking-maintenance-dev \
  --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

echo "[LocalStack Init] ✅ S3 buckets ready:"
echo "  s3://pgbooking-kyc-dev"
echo "  s3://pgbooking-properties-dev"
echo "  s3://pgbooking-maintenance-dev"
