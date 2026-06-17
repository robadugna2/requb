import { SetMetadata } from '@nestjs/common';

export const OWNER_ONLY_KEY = 'group_owner_only';
export const RequireGroupOwner = () => SetMetadata(OWNER_ONLY_KEY, true);
