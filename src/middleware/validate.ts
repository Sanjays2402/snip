import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { AppError } from '../utils/errors.js';

type RequestField = 'body' | 'query' | 'params';

export function validate(schema: ZodSchema, field: RequestField = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const parsed = schema.parse(req[field]);
      // Replace with parsed (coerced) values
      if (field === 'body') req.body = parsed;
      else if (field === 'query') (req as unknown as Record<string, unknown>).query = parsed;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const details = err.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        next(AppError.badRequest('Validation failed', details));
        return;
      }
      next(err);
    }
  };
}
