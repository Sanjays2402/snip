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

export const createWebhookSchema = z.object({
  url: z.string().url('Invalid webhook URL'),
  events: z
    .array(z.enum(['link.clicked', 'link.created', 'link.threshold_reached', 'link.expired']))
    .min(1, 'At least one event is required'),
});

// QR code query params
export const qrQuerySchema = z.object({
  size: z.coerce.number().int().min(100).max(2000).default(300),
  format: z.enum(['png', 'svg']).default('png'),
  fg_color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Invalid hex color').default('#000000'),
  bg_color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Invalid hex color').default('#ffffff'),
  logo_url: z.string().url().optional(),
});

// Workspace schemas
export const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z
    .string()
    .min(2)
    .max(255)
    .regex(/^[a-z0-9_-]+$/, 'Slug must be lowercase alphanumeric with hyphens/underscores'),
});

export const updateWorkspaceSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  slug: z
    .string()
    .min(2)
    .max(255)
    .regex(/^[a-z0-9_-]+$/, 'Slug must be lowercase alphanumeric with hyphens/underscores')
    .optional(),
});

export const inviteMemberSchema = z.object({
  email: z.string().email('Invalid email'),
  role: z.enum(['admin', 'editor', 'viewer']),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(['admin', 'editor', 'viewer']),
});

export const transferOwnershipSchema = z.object({
  newOwnerId: z.string().uuid('Invalid user ID'),
});

// Type exports
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateLinkInput = z.infer<typeof createLinkSchema>;
export type UpdateLinkInput = z.infer<typeof updateLinkSchema>;
export type BulkCreateLinksInput = z.infer<typeof bulkCreateLinksSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
export type CreateWebhookInput = z.infer<typeof createWebhookSchema>;
export type QRQueryInput = z.infer<typeof qrQuerySchema>;
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
export type TransferOwnershipInput = z.infer<typeof transferOwnershipSchema>;
