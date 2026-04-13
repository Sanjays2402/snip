import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().max(255).optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const createApiKeySchema = z.object({
  name: z.string().min(1).max(255),
  scopes: z.array(z.string()).default([]),
  expiresAt: z.string().datetime().optional(),
});

export const createLinkSchema = z.object({
  url: z.string().url('Invalid URL'),
  customSlug: z
    .string()
    .min(3)
    .max(50)
    .regex(/^[a-zA-Z0-9_-]+$/, 'Slug can only contain alphanumeric characters, hyphens, and underscores')
    .optional(),
  title: z.string().max(500).optional(),
  tags: z.array(z.string().max(50)).max(10).default([]),
  password: z.string().min(4).optional(),
  expiresAt: z.string().datetime().optional(),
  maxClicks: z.number().int().positive().optional(),
  isPermanent: z.boolean().default(false),
});

export const updateLinkSchema = z.object({
  url: z.string().url('Invalid URL').optional(),
  title: z.string().max(500).nullable().optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
  password: z.string().min(4).nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  maxClicks: z.number().int().positive().nullable().optional(),
  isActive: z.boolean().optional(),
  isPermanent: z.boolean().optional(),
});

export const bulkCreateLinksSchema = z.object({
  links: z.array(createLinkSchema).min(1).max(100),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  tag: z.string().optional(),
});

export const verifyPasswordSchema = z.object({
  password: z.string().min(1, 'Password is required'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateLinkInput = z.infer<typeof createLinkSchema>;
export type UpdateLinkInput = z.infer<typeof updateLinkSchema>;
export type BulkCreateLinksInput = z.infer<typeof bulkCreateLinksSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
