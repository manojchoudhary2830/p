import { Response } from 'express';
import { ApiResponse, PaginatedResult, PaginationParams, SortOrder } from '@shared/types';

// ─────────────────────────────────────────────
// Response Builders
// ─────────────────────────────────────────────

export function sendSuccess<T>(
  res: Response,
  data: T,
  message?: string,
  statusCode = 200,
  meta?: Record<string, unknown>,
): void {
  const response: ApiResponse<T> = {
    status: 'success',
    ...(message && { message }),
    data,
    ...(meta && { meta }),
  };
  res.status(statusCode).json(response);
}

export function sendCreated<T>(
  res: Response,
  data: T,
  message?: string,
  meta?: Record<string, unknown>,
): void {
  sendSuccess(res, data, message, 201, meta);
}

export function sendNoContent(res: Response): void {
  res.status(204).send();
}

export function sendPaginated<T>(
  res: Response,
  result: PaginatedResult<T>,
  message?: string,
): void {
  const response: ApiResponse<T[]> = {
    status: 'success',
    ...(message && { message }),
    data: result.data,
    meta: result.meta,
  };
  res.status(200).json(response);
}

// ─────────────────────────────────────────────
// Pagination
// ─────────────────────────────────────────────

export function parsePaginationParams(
  query: Record<string, string | string[] | undefined>,
  defaults: { limit?: number; maxLimit?: number } = {},
): PaginationParams {
  const maxLimit = defaults.maxLimit ?? 100;
  const defaultLimit = defaults.limit ?? 20;

  const page = Math.max(1, parseInt((query.page as string) ?? '1', 10) || 1);
  const limit = Math.min(
    maxLimit,
    Math.max(1, parseInt((query.limit as string) ?? String(defaultLimit), 10) || defaultLimit),
  );
  const sortBy = (query.sortBy as string) ?? undefined;
  const sortOrder =
    (query.sortOrder as string)?.toUpperCase() === 'DESC' ? SortOrder.DESC : SortOrder.ASC;

  return { page, limit, sortBy, sortOrder };
}

export function buildPaginatedResult<T>(
  data: T[],
  total: number,
  params: PaginationParams,
): PaginatedResult<T> {
  const totalPages = Math.ceil(total / params.limit);
  return {
    data,
    meta: {
      total,
      page: params.page,
      limit: params.limit,
      totalPages,
      hasNextPage: params.page < totalPages,
      hasPreviousPage: params.page > 1,
    },
  };
}

export function buildOffset(params: PaginationParams): { limit: number; offset: number } {
  return {
    limit: params.limit,
    offset: (params.page - 1) * params.limit,
  };
}

// ─────────────────────────────────────────────
// Query Sanitization
// ─────────────────────────────────────────────

const ALLOWED_SORT_DIRECTIONS = new Set(['ASC', 'DESC']);

export function sanitizeSortDirection(direction: string | undefined): 'ASC' | 'DESC' {
  const upper = (direction ?? 'ASC').toUpperCase();
  return ALLOWED_SORT_DIRECTIONS.has(upper) ? (upper as 'ASC' | 'DESC') : 'ASC';
}

/**
 * Whitelist-based column name sanitization to prevent SQL injection in ORDER BY clauses.
 * Always use this before interpolating column names into SQL.
 */
export function sanitizeSortColumn(
  column: string | undefined,
  allowedColumns: string[],
  defaultColumn: string,
): string {
  if (!column) return defaultColumn;
  return allowedColumns.includes(column) ? column : defaultColumn;
}

// ─────────────────────────────────────────────
// Data Transformation Utilities
// ─────────────────────────────────────────────

export function omitFields<T extends object, K extends keyof T>(
  obj: T,
  fields: K[],
): Omit<T, K> {
  const result = { ...obj };
  fields.forEach((field) => delete result[field]);
  return result;
}

export function pickFields<T extends object, K extends keyof T>(
  obj: T,
  fields: K[],
): Pick<T, K> {
  const result = {} as Pick<T, K>;
  fields.forEach((field) => {
    if (field in obj) result[field] = obj[field];
  });
  return result;
}

export function toDecimal(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return parseFloat(String(value));
}

export function formatCurrency(
  amount: number | string,
  currency = 'INR',
): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(toDecimal(amount));
}
