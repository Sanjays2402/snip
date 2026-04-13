import { Response, NextFunction } from 'express';
import multer from 'multer';
import { parse as csvParse } from 'csv-parse/sync';
import { stringify as csvStringify } from 'csv-stringify/sync';
import { linkService } from '../services/index.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { paginationSchema, createLinkSchema } from '../utils/validators.js';
import { AppError } from '../utils/errors.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
}).single('file');

export async function createLink(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const link = await linkService.createLink(req.userId!, req.body);
    res.status(201).json(link);
  } catch (err) {
    next(err);
  }
}

export async function bulkCreateLinks(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const results = await linkService.bulkCreateLinks(req.userId!, req.body.links);
    res.status(201).json({ links: results });
  } catch (err) {
    next(err);
  }
}

export async function getLinks(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const pagination = paginationSchema.parse(req.query);
    const result = await linkService.getUserLinks(req.userId!, pagination);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getLinkById(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const link = await linkService.getLinkById(req.userId!, req.params.id as string);
    res.json(link);
  } catch (err) {
    next(err);
  }
}

export async function updateLink(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const link = await linkService.updateLink(req.userId!, req.params.id as string, req.body);
    res.json(link);
  } catch (err) {
    next(err);
  }
}

export async function deleteLink(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await linkService.deleteLink(req.userId!, req.params.id as string);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

interface CsvRow {
  original_url: string;
  custom_slug?: string;
  tags?: string;
  expires_at?: string;
}

export async function importLinks(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  upload(req, res, async (uploadErr) => {
    try {
      if (uploadErr) {
        throw AppError.badRequest(uploadErr.message);
      }

      const file = req.file;
      if (!file) {
        throw AppError.badRequest('No CSV file provided');
      }

      const records = csvParse(file.buffer.toString('utf-8'), {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      }) as CsvRow[];

      let imported = 0;
      const errors: Array<{ row: number; error: string }> = [];

      for (let i = 0; i < records.length; i++) {
        const row = records[i];
        try {
          const input = createLinkSchema.parse({
            url: row.original_url,
            customSlug: row.custom_slug || undefined,
            tags: row.tags ? row.tags.split(';').map((t) => t.trim()).filter(Boolean) : [],
            expiresAt: row.expires_at || undefined,
          });
          await linkService.createLink(req.userId!, input);
          imported++;
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          errors.push({ row: i + 2, error: message }); // +2 for 1-index + header
        }
      }

      res.status(201).json({
        imported,
        failed: errors.length,
        errors: errors.slice(0, 50), // Cap error details
      });
    } catch (err) {
      next(err);
    }
  });
}

export async function exportLinks(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // Get all user links (up to 10000)
    const result = await linkService.getUserLinks(req.userId!, { page: 1, limit: 10000 });

    const rows = result.links.map((link) => ({
      original_url: link.originalUrl,
      custom_slug: link.shortCode,
      tags: link.tags.join(';'),
      expires_at: link.expiresAt ? new Date(link.expiresAt).toISOString() : '',
      short_url: link.shortUrl,
      click_count: link.clickCount,
      created_at: new Date(link.createdAt).toISOString(),
    }));

    const csv = csvStringify(rows, {
      header: true,
      columns: [
        { key: 'original_url', header: 'original_url' },
        { key: 'custom_slug', header: 'custom_slug' },
        { key: 'tags', header: 'tags' },
        { key: 'expires_at', header: 'expires_at' },
        { key: 'short_url', header: 'short_url' },
        { key: 'click_count', header: 'click_count' },
        { key: 'created_at', header: 'created_at' },
      ],
    });

    res.set('Content-Type', 'text/csv');
    res.set('Content-Disposition', 'attachment; filename="snip-links.csv"');
    res.send(csv);
  } catch (err) {
    next(err);
  }
}
