import { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from './auth.js';
import { workspaceService } from '../services/index.js';
import { AppError } from '../utils/errors.js';

type WorkspaceRole = 'admin' | 'editor' | 'viewer';

export function checkWorkspaceRole(minRole: WorkspaceRole) {
  return async (req: AuthenticatedRequest, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const workspaceId = req.params.workspaceId as string | undefined;
      if (!workspaceId) {
        throw AppError.badRequest('Missing workspaceId parameter');
      }

      const hasRole = await workspaceService.checkMemberRole(
        workspaceId,
        req.userId!,
        minRole,
      );

      if (!hasRole) {
        throw AppError.forbidden(`Requires ${minRole} role or higher`);
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
