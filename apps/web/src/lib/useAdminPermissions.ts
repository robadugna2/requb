'use client';

import { useState, useEffect } from 'react';
import { getGroups, getGroupLeaders } from '@/lib/api';

export interface GroupPermissions {
  canManageMembers: boolean;
  canManageDeposits: boolean;
  canTriggerLottery: boolean;
  canManageRules: boolean;
}

export interface AdminPermissions {
  role: string;
  userId: string;
  isFullAccess: boolean;
  loading: boolean;
  permissionsByGroup: Record<string, GroupPermissions>;
}

function parseJwt(): { role: string; id: string } | null {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem('equb_token');
  if (!token) return null;
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const payload = JSON.parse(jsonPayload);
    return {
      role: payload.role || 'ADMIN',
      id: payload.sub || payload.id || '',
    };
  } catch {
    return null;
  }
}

export function useAdminPermissions(): AdminPermissions {
  // Parse JWT synchronously on first render to avoid flickering
  const [parsed] = useState<{ role: string; id: string } | null>(() => parseJwt());
  const initialRole = parsed?.role || '';
  const initialUserId = parsed?.id || '';
  const initialIsFullAccess = initialRole === 'SUPER_ADMIN' || initialRole === 'ADMIN';
  // Only SUB_ADMINs need async loading for per-group permissions
  const initialLoading = !!parsed && !initialIsFullAccess;

  const [loading, setLoading] = useState<boolean>(initialLoading);
  const [permissionsByGroup, setPermissionsByGroup] = useState<Record<string, GroupPermissions>>({});

  useEffect(() => {
    if (!parsed || initialIsFullAccess) return;

    // SUB_ADMIN: fetch groups and then leaders for each group
    const fetchPermissions = async () => {
      try {
        const groups = await getGroups();
        const results = await Promise.allSettled(
          groups.map((g) => getGroupLeaders(g.id))
        );

        const permsMap: Record<string, GroupPermissions> = {};
        results.forEach((result, idx) => {
          if (result.status === 'fulfilled') {
            const leaders = result.value;
            const myLeader = leaders.find((l) => l.adminId === parsed.id);
            if (myLeader) {
              permsMap[groups[idx].id] = {
                canManageMembers: myLeader.canManageMembers,
                canManageDeposits: myLeader.canManageDeposits,
                canTriggerLottery: myLeader.canTriggerLottery,
                canManageRules: myLeader.canManageRules,
              };
            }
          }
        });

        setPermissionsByGroup(permsMap);
      } catch {
        // Fail secure: don't grant UI access on network error
        // Backend guards still enforce security, and pages will simply hide action buttons
      } finally {
        setLoading(false);
      }
    };

    fetchPermissions();
  }, []);

  return { role: initialRole, userId: initialUserId, isFullAccess: initialIsFullAccess, loading, permissionsByGroup };
}

/** Check if user has a specific permission for a given group */
export function hasPermission(
  permissions: AdminPermissions,
  groupId: string,
  permission: keyof GroupPermissions
): boolean {
  if (permissions.isFullAccess) return true;
  return permissions.permissionsByGroup[groupId]?.[permission] ?? false;
}

/** Check if user has a specific permission for ANY group */
export function hasAnyGroupPermission(
  permissions: AdminPermissions,
  permission: keyof GroupPermissions
): boolean {
  if (permissions.isFullAccess) return true;
  return Object.values(permissions.permissionsByGroup).some((p) => p[permission]);
}
