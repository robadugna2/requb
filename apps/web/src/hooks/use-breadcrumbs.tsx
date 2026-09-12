'use client';

import { usePathname } from 'next/navigation';
import { useMemo } from 'react';

type BreadcrumbItem = {
  title: string;
  link: string;
};

const routeMapping: Record<string, BreadcrumbItem[]> = {
  '/dashboard': [{ title: 'Dashboard', link: '/dashboard' }],
  '/groups': [
    { title: 'Dashboard', link: '/dashboard' },
    { title: 'Groups', link: '/groups' }
  ],
  '/members': [
    { title: 'Dashboard', link: '/dashboard' },
    { title: 'Members', link: '/members' }
  ],
  '/receipts': [
    { title: 'Dashboard', link: '/dashboard' },
    { title: 'Receipts', link: '/receipts' }
  ],
  '/scan': [
    { title: 'Dashboard', link: '/dashboard' },
    { title: 'Scan FT', link: '/scan' }
  ],
};

export function useBreadcrumbs() {
  const pathname = usePathname();

  const breadcrumbs = useMemo(() => {
    if (routeMapping[pathname]) {
      return routeMapping[pathname];
    }
    const segments = pathname.split('/').filter(Boolean);
    return segments.map((segment, index) => {
      const path = `/${segments.slice(0, index + 1).join('/')}`;
      // Dynamic route ids (Prisma CUIDs like "cmqh5w5ft...") are noise in a
      // breadcrumb — the page itself shows the real title.
      const isCuid = /^c[a-z0-9]{20,}$/.test(segment);
      const title = isCuid
        ? 'Details'
        : segment.charAt(0).toUpperCase() + segment.slice(1);
      return { title, link: path };
    });
  }, [pathname]);

  return breadcrumbs;
}
