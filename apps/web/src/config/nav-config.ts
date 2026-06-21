import { LayoutDashboard, Users, UsersRound, Receipt, UserCog, Settings, LogOut, Ticket } from 'lucide-react';

export interface NavItem {
  title: string;
  url: string;
  icon?: any;
  isActive?: boolean;
  items?: NavItem[];
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
        url: '/dashboard',
        icon: LayoutDashboard,
      },
    ],
  },
  {
    label: 'Management',
    items: [
      {
        title: 'Groups',
        url: '/groups',
        icon: Users,
      },
      {
        title: 'Members',
        url: '/members',
        icon: UsersRound,
      },
      {
        title: 'Receipts',
        url: '/receipts',
        icon: Receipt,
      },
      {
        title: 'Lottery',
        url: '/lottery',
        icon: Ticket,
      },
      {
        title: 'Admins',
        url: '/admins',
        icon: UserCog,
      },
    ],
  },
  {
    label: 'System',
    items: [
      {
        title: 'Settings',
        url: '/settings',
        icon: Settings,
      },
    ],
  },
];
