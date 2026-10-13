import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ValidationFailedError } from '@shared/errors';
import { ValidationError } from '@shared/types';

type RequestPart = 'body' | 'query' | 'params';

function formatZodErrors(error: ZodError): ValidationError[] {
  return error.errors.map((issue: any) => ({
    field: issue.path.join('.') || 'root',
    message: issue.message,
    code: issue.code,
  }));
}

export function validate(schema: ZodSchema, part: RequestPart = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[part]);
    if (!result.success) {
      next(new ValidationFailedError(formatZodErrors(result.error)));
      return;
    }
    // Replace with parsed (coerced/transformed) data
    (req as Record<string, unknown>)[part] = result.data;
    next();
  };
}

export function validateBody(schema: ZodSchema) {
  return validate(schema, 'body');
}

export function validateQuery(schema: ZodSchema) {
  return validate(schema, 'query');
}

export function validateParams(schema: ZodSchema) {
  return validate(schema, 'params');
}

/** Validate multiple parts simultaneously */
export function validateRequest(schemas: Partial<Record<RequestPart, ZodSchema>>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const errors: ValidationError[] = [];

    for (const [part, schema] of Object.entries(schemas) as [RequestPart, ZodSchema][]) {
      const result = schema.safeParse(req[part]);
      if (!result.success) {
        errors.push(...formatZodErrors(result.error).map((e) => ({
          ...e,
          field: `${part}.${e.field}`,
        })));
      } else {
        (req as Record<string, unknown>)[part] = result.data;
      }
    }

    if (errors.length > 0) {
      next(new ValidationFailedError(errors));
      return;
    }
    next();
  };
}
