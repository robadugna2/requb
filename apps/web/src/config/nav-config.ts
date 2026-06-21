import { LayoutDashboard, Users, UsersRound, Receipt, UserCog, Settings, BookTemplate, Bell, Ticket } from 'lucide-react';

export interface NavItem {
  title: string;
  key: string;
  url: string;
  icon?: any;
  isActive?: boolean;
  items?: NavItem[];
  roles: string[];
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const navGroups: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      {
        title: 'Dashboard',
        key: 'nav.dashboard',
        url: '/dashboard',
        icon: LayoutDashboard,
        roles: ['SUPER_ADMIN', 'ADMIN', 'SUB_ADMIN'],
      },
    ],
  },
  {
    label: 'Management',
    items: [
      {
        title: 'Groups',
        key: 'nav.groups',
        url: '/groups',
        icon: Users,
        roles: ['SUPER_ADMIN', 'ADMIN', 'SUB_ADMIN'],
      },
      {
        title: 'Members',
        key: 'nav.members',
        url: '/members',
        icon: UsersRound,
        roles: ['SUPER_ADMIN', 'ADMIN'],
      },
      {
        title: 'Receipts',
        key: 'nav.receipts',
        url: '/receipts',
        icon: Receipt,
        roles: ['SUPER_ADMIN', 'ADMIN', 'SUB_ADMIN'],
      },
      {
        title: 'Lottery',
        key: 'nav.lottery',
        url: '/lottery',
        icon: Ticket,
        roles: ['SUPER_ADMIN', 'ADMIN', 'SUB_ADMIN'],
      },
      {
        title: 'Rule Templates',
        key: 'nav.rules',
        url: '/rule-templates',
        icon: BookTemplate,
        roles: ['SUPER_ADMIN', 'ADMIN'],
      },
      {
        title: 'Notifications',
        key: 'nav.notifications',
        url: '/notifications',
        icon: Bell,
        roles: ['SUPER_ADMIN', 'ADMIN', 'SUB_ADMIN'],
      },
      {
        title: 'Admins',
        key: 'nav.admins',
        url: '/admins',
        icon: UserCog,
        roles: ['SUPER_ADMIN', 'ADMIN'],
      },
    ],
  },
  {
    label: 'System',
    items: [
      {
        title: 'Settings',
        key: 'nav.settings',
        url: '/settings',
        icon: Settings,
        roles: ['SUPER_ADMIN', 'ADMIN', 'SUB_ADMIN'],
      },
    ],
  },
];
