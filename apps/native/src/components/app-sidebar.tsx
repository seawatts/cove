'use client';

import { Link, useRouter } from '@tanstack/react-router';
import {
  BookOpen,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Github,
  Home,
  LayoutDashboard,
  Lightbulb,
  ScrollText,
  ShieldCheck,
  Smartphone,
  User2,
  Workflow,
  Zap,
} from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@acme/ui/dropdown-menu';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  SidebarTrigger,
} from '@acme/ui/sidebar';

export function AppSidebar() {
  const router = useRouter();

  // Menu items.
  const monitoringItems = [
    {
      icon: LayoutDashboard,
      title: 'Dashboard',
      to: '/dashboards',
    },
    {
      icon: Smartphone,
      title: 'Devices',
      to: '/devices',
    },
    {
      icon: Home,
      title: 'Rooms',
      to: '/rooms',
    },
    {
      icon: Lightbulb,
      title: 'Scenes',
      to: '/scenes',
    },
  ];
  const automationItems = [
    {
      icon: Workflow,
      title: 'Automations',
      to: '/automations',
    },
    {
      icon: CalendarClock,
      title: 'Schedules',
      to: '/schedules',
    },
    {
      icon: ScrollText,
      title: 'Scripts',
      to: '/scripts',
    },
    {
      icon: ShieldCheck,
      title: 'Security',
      to: '/security',
    },
    {
      icon: Zap,
      title: 'Energy',
      to: '/energy',
    },
  ];

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="flex-row items-center gap-2">
        <SidebarTrigger className="h-8 w-8" />
        <SidebarMenu className="group-data-[collapsible=icon]:hidden">
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton>
                  Cove
                  <ChevronDown className="ml-auto" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[--radix-popper-anchor-width]">
                <DropdownMenuItem>
                  <span>Home</span>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <span>Vacation Home</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Home</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {monitoringItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={router.state.location.pathname === item.to}
                  >
                    <Link to={item.to}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Automation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {automationItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={router.state.location.pathname === item.to}
                  >
                    <Link to={item.to}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <a
                href="https://docs.cove.dev"
                target="_blank"
                className="flex items-center justify-between"
                rel="noreferrer"
              >
                <span className="flex items-center gap-2">
                  <BookOpen className="size-4" />
                  <span>Documentation</span>
                </span>
                <ExternalLink className="size-4" />
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <a
                href="https://github.com/seawatts/cove"
                target="_blank"
                className="flex items-center justify-between"
                rel="noreferrer"
              >
                <span className="flex items-center gap-2">
                  <Github className="size-4" />
                  <span>GitHub</span>
                </span>
                <ExternalLink className="size-4" />
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarSeparator />
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton>
                  <User2 /> seawatts
                  <ChevronUp className="ml-auto" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                className="w-[--radix-popper-anchor-width]"
              >
                <DropdownMenuItem>
                  <span>Settings</span>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <span>System</span>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
