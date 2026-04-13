import { eq, and } from 'drizzle-orm';
import { db } from '../config/database.js';
import { workspaces, workspaceMembers, users } from '../models/schema.js';
import { AppError } from '../utils/errors.js';
import type {
  CreateWorkspaceInput,
  UpdateWorkspaceInput,
  InviteMemberInput,
  UpdateMemberRoleInput,
} from '../utils/validators.js';

type WorkspaceRole = 'admin' | 'editor' | 'viewer';

export async function createWorkspace(userId: string, input: CreateWorkspaceInput) {
  // Check slug uniqueness
  const existing = await db.query.workspaces.findFirst({
    where: eq(workspaces.slug, input.slug),
  });
  if (existing) {
    throw AppError.conflict(`Workspace slug "${input.slug}" is already taken`);
  }

  const [workspace] = await db
    .insert(workspaces)
    .values({
      name: input.name,
      slug: input.slug,
      ownerId: userId,
    })
    .returning();

  // Add owner as admin member
  await db.insert(workspaceMembers).values({
    workspaceId: workspace.id,
    userId,
    role: 'admin',
  });

  return workspace;
}

export async function getUserWorkspaces(userId: string) {
  const memberships = await db.query.workspaceMembers.findMany({
    where: eq(workspaceMembers.userId, userId),
    with: {
      workspace: true,
    },
  });

  return memberships.map((m) => ({
    ...m.workspace,
    role: m.role,
  }));
}

export async function getWorkspaceById(userId: string, workspaceId: string) {
  const membership = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, workspaceId),
      eq(workspaceMembers.userId, userId),
    ),
  });

  if (!membership) {
    throw AppError.notFound('Workspace not found');
  }

  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.id, workspaceId),
  });

  if (!workspace) {
    throw AppError.notFound('Workspace not found');
  }

  const members = await db.query.workspaceMembers.findMany({
    where: eq(workspaceMembers.workspaceId, workspaceId),
    with: {
      user: true,
    },
  });

  return {
    ...workspace,
    role: membership.role,
    members: members.map((m) => ({
      userId: m.userId,
      role: m.role,
      email: m.user.email,
      name: m.user.name,
      createdAt: m.createdAt,
    })),
  };
}

export async function updateWorkspace(
  userId: string,
  workspaceId: string,
  input: UpdateWorkspaceInput,
) {
  await requireRole(workspaceId, userId, 'admin');

  if (input.slug) {
    const existing = await db.query.workspaces.findFirst({
      where: and(
        eq(workspaces.slug, input.slug),
      ),
    });
    if (existing && existing.id !== workspaceId) {
      throw AppError.conflict(`Workspace slug "${input.slug}" is already taken`);
    }
  }

  const updateData: Record<string, unknown> = {};
  if (input.name !== undefined) updateData.name = input.name;
  if (input.slug !== undefined) updateData.slug = input.slug;

  const [updated] = await db
    .update(workspaces)
    .set(updateData)
    .where(eq(workspaces.id, workspaceId))
    .returning();

  return updated;
}

export async function deleteWorkspace(userId: string, workspaceId: string) {
  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.id, workspaceId),
  });

  if (!workspace) {
    throw AppError.notFound('Workspace not found');
  }

  if (workspace.ownerId !== userId) {
    throw AppError.forbidden('Only the workspace owner can delete it');
  }

  await db.delete(workspaces).where(eq(workspaces.id, workspaceId));
}

export async function inviteMember(
  userId: string,
  workspaceId: string,
  input: InviteMemberInput,
) {
  await requireRole(workspaceId, userId, 'admin');

  const targetUser = await db.query.users.findFirst({
    where: eq(users.email, input.email),
  });

  if (!targetUser) {
    throw AppError.notFound(`User with email "${input.email}" not found`);
  }

  // Check if already a member
  const existing = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, workspaceId),
      eq(workspaceMembers.userId, targetUser.id),
    ),
  });

  if (existing) {
    throw AppError.conflict('User is already a member of this workspace');
  }

  await db.insert(workspaceMembers).values({
    workspaceId,
    userId: targetUser.id,
    role: input.role,
  });

  return {
    userId: targetUser.id,
    email: targetUser.email,
    name: targetUser.name,
    role: input.role,
  };
}

export async function updateMemberRole(
  userId: string,
  workspaceId: string,
  targetUserId: string,
  input: UpdateMemberRoleInput,
) {
  await requireRole(workspaceId, userId, 'admin');

  // Can't change owner's role
  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.id, workspaceId),
  });
  if (workspace && workspace.ownerId === targetUserId) {
    throw AppError.forbidden('Cannot change the workspace owner\'s role');
  }

  const member = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, workspaceId),
      eq(workspaceMembers.userId, targetUserId),
    ),
  });

  if (!member) {
    throw AppError.notFound('Member not found');
  }

  await db
    .update(workspaceMembers)
    .set({ role: input.role })
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, targetUserId),
      ),
    );

  return { userId: targetUserId, role: input.role };
}

export async function removeMember(
  userId: string,
  workspaceId: string,
  targetUserId: string,
) {
  await requireRole(workspaceId, userId, 'admin');

  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.id, workspaceId),
  });
  if (workspace && workspace.ownerId === targetUserId) {
    throw AppError.forbidden('Cannot remove the workspace owner');
  }

  const member = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, workspaceId),
      eq(workspaceMembers.userId, targetUserId),
    ),
  });

  if (!member) {
    throw AppError.notFound('Member not found');
  }

  await db
    .delete(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, targetUserId),
      ),
    );
}

export async function transferOwnership(
  userId: string,
  workspaceId: string,
  newOwnerId: string,
) {
  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.id, workspaceId),
  });

  if (!workspace) {
    throw AppError.notFound('Workspace not found');
  }

  if (workspace.ownerId !== userId) {
    throw AppError.forbidden('Only the workspace owner can transfer ownership');
  }

  // New owner must be a member
  const member = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, workspaceId),
      eq(workspaceMembers.userId, newOwnerId),
    ),
  });

  if (!member) {
    throw AppError.notFound('New owner must be a member of the workspace');
  }

  // Transfer ownership
  await db
    .update(workspaces)
    .set({ ownerId: newOwnerId })
    .where(eq(workspaces.id, workspaceId));

  // Make new owner admin
  await db
    .update(workspaceMembers)
    .set({ role: 'admin' })
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, newOwnerId),
      ),
    );

  return { workspaceId, newOwnerId };
}

// Helper: require minimum role
const ROLE_HIERARCHY: Record<WorkspaceRole, number> = {
  viewer: 0,
  editor: 1,
  admin: 2,
};

async function requireRole(
  workspaceId: string,
  userId: string,
  minRole: WorkspaceRole,
): Promise<void> {
  const membership = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, workspaceId),
      eq(workspaceMembers.userId, userId),
    ),
  });

  if (!membership) {
    throw AppError.forbidden('You are not a member of this workspace');
  }

  if (ROLE_HIERARCHY[membership.role] < ROLE_HIERARCHY[minRole]) {
    throw AppError.forbidden(`Requires ${minRole} role or higher`);
  }
}

// Exported for middleware use
export async function checkMemberRole(
  workspaceId: string,
  userId: string,
  minRole: WorkspaceRole,
): Promise<boolean> {
  const membership = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, workspaceId),
      eq(workspaceMembers.userId, userId),
    ),
  });

  if (!membership) return false;
  return ROLE_HIERARCHY[membership.role] >= ROLE_HIERARCHY[minRole];
}
