import { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { apiKeyService } from '../services/index.js';

export async function createKey(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { name, scopes, expiresAt } = req.body;
    const key = await apiKeyService.createApiKey(req.userId!, name, scopes, expiresAt);
    res.status(201).json(key);
  } catch (err) {
    next(err);
  }
}

export async function listKeys(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const keys = await apiKeyService.listApiKeys(req.userId!);
    res.json({ keys });
  } catch (err) {
    next(err);
  }
}

export async function deleteKey(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await apiKeyService.deleteApiKey(req.userId!, req.params.id as string);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
