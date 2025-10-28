'use client';

import { useAuth, useUser } from '@clerk/nextjs';
import { MetricLink } from '@cove/analytics/components';
import { Avatar, AvatarFallback, AvatarImage } from '@cove/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@cove/ui/dropdown-menu';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@cove/ui/sidebar';
import { ToggleGroup, ToggleGroupItem } from '@cove/ui/toggle-group';
import {
  ArrowLeftFromLine,
  ChevronsUpDown,
  Laptop,
  MoonIcon,
  Settings,
  SunIcon,
} from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import posthog from 'posthog-js';

export function NavUser() {
  const pathname = usePathname();
  const isOnboarding = pathname?.startsWith('/app/onboarding');
  const { setTheme } = useTheme();
  const _router = useRouter();
  const { user } = useUser();
  const { signOut } = useAuth();
  const { theme } = useTheme();

  if (!user) {
    return null;
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              size="lg"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-accent text-sidebar-accent-foreground">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={user.imageUrl} />
                  <AvatarFallback>
                    {user.firstName?.charAt(0) ||
                      user.emailAddresses[0]?.emailAddress.split('@')[0]}
                  </AvatarFallback>
                </Avatar>
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">
                  {user.firstName ||
                    user.emailAddresses[0]?.emailAddress.split('@')[0]}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {user.emailAddresses[0]?.emailAddress}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-64 rounded-lg"
            side="top"
            sideOffset={10}
          >
            <div className="px-2 py-1.5">
              <div className="text-sm font-medium">
                {user.firstName ||
                  user.emailAddresses[0]?.emailAddress.split('@')[0]}
              </div>
              <div className="text-xs text-muted-foreground">
                {user.emailAddresses[0]?.emailAddress}
              </div>
            </div>
            <div className="px-2 py-1.5">
              <ToggleGroup
                className="w-full"
                onValueChange={(value) => value && setTheme(value)}
                type="single"
                value={theme}
                variant="outline"
              >
                <ToggleGroupItem aria-label="Light theme" value="light">
                  <SunIcon className="size-4" />
                </ToggleGroupItem>
                <ToggleGroupItem aria-label="Dark theme" value="dark">
                  <MoonIcon className="size-4" />
                </ToggleGroupItem>
                <ToggleGroupItem aria-label="System theme" value="system">
                  <Laptop className="size-4" />
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
            <DropdownMenuSeparator />
            {!isOnboarding && (
              <DropdownMenuItem asChild>
                <MetricLink
                  href={'/app/settings'}
                  metric="nav_user_settings_clicked"
                  properties={{
                    destination: '/app/settings',
                    location: 'nav_user',
                  }}
                >
                  <Settings className="mr-1 size-4" />
                  <span>Settings</span>
                </MetricLink>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={() => {
                // Track user logout action
                posthog.capture('user_logout_clicked', {
                  email: user.emailAddresses[0]?.emailAddress,
                  source: 'nav_user_dropdown',
                  user_id: user.id,
                });
                signOut();
              }}
            >
              <ArrowLeftFromLine className="mr-1 size-4" />
              <span>Sign out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
