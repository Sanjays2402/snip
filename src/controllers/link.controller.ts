import { Response, NextFunction } from 'express';
import { linkService } from '../services/index.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { paginationSchema } from '../utils/validators.js';

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
