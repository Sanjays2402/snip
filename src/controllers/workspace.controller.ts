import { Response, NextFunction } from 'express';
import { workspaceService } from '../services/index.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';

export async function createWorkspace(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const workspace = await workspaceService.createWorkspace(req.userId!, req.body);
    res.status(201).json(workspace);
  } catch (err) {
    next(err);
  }
}

export async function getUserWorkspaces(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const workspaces = await workspaceService.getUserWorkspaces(req.userId!);
    res.json({ workspaces });
  } catch (err) {
    next(err);
  }
}

export async function getWorkspaceById(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const workspace = await workspaceService.getWorkspaceById(
      req.userId!,
      req.params.id as string,
    );
    res.json(workspace);
  } catch (err) {
    next(err);
  }
}

export async function updateWorkspace(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const workspace = await workspaceService.updateWorkspace(
      req.userId!,
      req.params.id as string,
      req.body,
    );
    res.json(workspace);
  } catch (err) {
    next(err);
  }
}

export async function deleteWorkspace(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await workspaceService.deleteWorkspace(req.userId!, req.params.id as string);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function inviteMember(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const member = await workspaceService.inviteMember(
      req.userId!,
      req.params.id as string,
      req.body,
    );
    res.status(201).json(member);
  } catch (err) {
    next(err);
  }
}

export async function updateMemberRole(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await workspaceService.updateMemberRole(
      req.userId!,
      req.params.id as string,
      req.params.userId as string,
      req.body,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function removeMember(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await workspaceService.removeMember(
      req.userId!,
      req.params.id as string,
      req.params.userId as string,
    );
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function transferOwnership(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await workspaceService.transferOwnership(
      req.userId!,
      req.params.id as string,
      req.body.newOwnerId,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}
