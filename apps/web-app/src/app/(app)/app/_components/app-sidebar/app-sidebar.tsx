'use client';

import { MetricLink } from '@cove/analytics';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@cove/ui/sidebar';
import {
  IconBrandGithub,
  IconCodeDots,
  IconDashboard,
  IconDevices,
  IconLayout,
  IconServer,
  IconSettings,
  IconSparkles,
} from '@tabler/icons-react';
import { usePathname } from 'next/navigation';
import type * as React from 'react';
import { Icons } from '~/app/(marketing)/_components/icons';
import { NavMain } from './nav-main';
import { NavSecondary } from './nav-secondary';
import { NavUser } from './nav-user';

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const isOnboarding = pathname?.startsWith('/app/onboarding');

  const data = {
    navMain: [
      {
        icon: IconDashboard,
        title: 'Dashboard',
        url: '/app/dashboard',
      },
      {
        icon: IconDevices,
        title: 'Devices',
        url: '/app/devices',
      },
      {
        icon: IconLayout,
        title: 'Rooms',
        url: '/app/rooms',
      },
      {
        icon: IconSparkles,
        title: 'Automations',
        url: '/app/automations',
      },
      {
        icon: IconServer,
        title: 'Hub',
        url: '/app/hub',
      },
      {
        icon: IconSettings,
        title: 'Settings',
        url: '/app/settings/organization',
      },
    ],
    navSecondary: [
      {
        icon: IconBrandGithub,
        title: 'GitHub',
        url: 'https://github.com/seawatts/cove',
      },
      {
        icon: IconCodeDots,
        title: 'Docs',
        url: 'https://cove.sh/docs',
      },
    ],
    user: {
      avatar: '/avatars/shadcn.jpg',
      email: 'm@example.com',
      name: 'shadcn',
    },
  };

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <MetricLink
                href={isOnboarding ? '/app/onboarding' : '/app/dashboard'}
                metric="navigation_logo_clicked"
              >
                <Icons.logo className="size-10" />
                <span className="text-base font-semibold">Cove</span>
              </MetricLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {!isOnboarding && <NavMain items={data.navMain} />}
        <div className="mt-auto">
          <NavSecondary items={data.navSecondary} />
        </div>
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}
