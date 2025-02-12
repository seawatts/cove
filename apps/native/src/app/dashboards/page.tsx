import {} from '@acme/api/server'
import { Button } from '@acme/ui/button'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@acme/ui/card'
import { Icons } from '@acme/ui/icons'
import { Skeleton } from '@acme/ui/skeleton'
import { H1, P, Text } from '@acme/ui/typography'
import Link from 'next/link'
import { Suspense } from 'react'

type Dashboard = {
  id: string
  name: string
  description: string
  deviceCount: number
  updatedAt: string
}

function DashboardsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from(['1', '2', '3', '4', '5', '6']).map((key) => (
        <Card key={key} className="flex flex-col">
          <CardHeader>
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-full" />
          </CardHeader>
          <CardContent className="flex-1">
            <div className="flex items-center gap-2">
              <Skeleton className="size-4" />
              <Skeleton className="h-4 w-16" />
            </div>
          </CardContent>
          <CardFooter>
            <Skeleton className="h-4 w-24" />
          </CardFooter>
        </Card>
      ))}
    </div>
  )
}

function DashboardGrid({ dashboards }: { dashboards: Dashboard[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {/* Create New Dashboard Card */}
      <Card className="flex flex-col border-dashed hover:border-primary/50 hover:shadow-md transition-all duration-200">
        <Button
          variant="ghost"
          className="h-full flex-1 flex-col gap-4 p-6"
          asChild
        >
          <Link href="/dashboards/new">
            <Icons.Plus className="size-8 text-muted-foreground" />
            <Text className="font-medium">Create Dashboard</Text>
            <Text className="text-sm text-muted-foreground">
              Add a new dashboard to organize your devices
            </Text>
          </Link>
        </Button>
      </Card>

      {/* Existing Dashboards */}
      {dashboards.map((dashboard) => (
        <Link
          key={dashboard.id}
          href={`/dashboards/${dashboard.id}`}
          className="block group"
        >
          <Card className="flex h-full flex-col group-hover:border-primary/50 group-hover:shadow-md transition-all duration-200">
            <CardHeader>
              <CardTitle>{dashboard.name}</CardTitle>
              <Text className="text-sm text-muted-foreground">
                {dashboard.description}
              </Text>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="flex items-center gap-2">
                <Icons.CircleDot className="size-4 text-primary" />
                <Text className="text-sm">
                  {dashboard.deviceCount}{' '}
                  {dashboard.deviceCount === 1 ? 'device' : 'devices'}
                </Text>
              </div>
            </CardContent>
            <CardFooter className="flex items-center justify-between">
              <Text className="text-sm text-muted-foreground">
                Updated {new Date(dashboard.updatedAt).toLocaleDateString()}
              </Text>
              <Icons.ArrowRight className="size-4 text-muted-foreground/50 transition-transform group-hover:translate-x-1 group-hover:text-primary" />
            </CardFooter>
          </Card>
        </Link>
      ))}
    </div>
  )
}

export default async function DashboardsPage() {
  // TODO: Replace with actual dashboard data once the API is ready
  const mockDashboards: Dashboard[] = [
    {
      id: '1',
      name: 'Living Room',
      description: 'Living room lights and entertainment',
      deviceCount: 5,
      updatedAt: new Date().toISOString(),
    },
    {
      id: '2',
      name: 'Kitchen',
      description: 'Kitchen appliances and lighting',
      deviceCount: 3,
      updatedAt: new Date().toISOString(),
    },
    {
      id: '3',
      name: 'Bedroom',
      description: 'Bedroom climate and lighting',
      deviceCount: 4,
      updatedAt: new Date().toISOString(),
    },
  ]

  return (
    <main className="container py-16">
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <H1>Dashboards</H1>
              <P className="text-muted-foreground">
                Create and manage your device dashboards
              </P>
            </div>
            <Button asChild>
              <Link href="/dashboards/new">
                <Icons.Plus className="size-4 mr-2" />
                New Dashboard
              </Link>
            </Button>
          </div>
        </div>

        <Suspense fallback={<DashboardsSkeleton />}>
          <DashboardGrid dashboards={mockDashboards} />
        </Suspense>
      </div>
    </main>
  )
}
