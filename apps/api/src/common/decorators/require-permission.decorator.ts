import { SetMetadata } from '@nestjs/common';

export const PERMISSION_KEY = 'group_permission';
export const RequirePermission = (permission: 'canManageMembers' | 'canManageDeposits' | 'canTriggerLottery' | 'canManageRules') =>
  SetMetadata(PERMISSION_KEY, permission);
