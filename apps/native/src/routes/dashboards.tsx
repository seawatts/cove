import { Button } from '@acme/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@acme/ui/card';
import { Icons } from '@acme/ui/icons';
import { H1, P } from '@acme/ui/typography';
import { createFileRoute } from '@tanstack/react-router';

function DashboardsPage() {
  return (
    <div className="container py-16">
      <div className="flex flex-col gap-8">
        <div className="flex flex-col items-center justify-center gap-4 text-center">
          <H1>Dashboards</H1>
          <P className="text-muted-foreground">
            Create and customize your home automation dashboards
          </P>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Button variant="outline" className="justify-start">
              <Icons.Plus className="size-4 mr-2" />
              New Dashboard
            </Button>
            <Button variant="outline" className="justify-start">
              <Icons.BarChart2 className="size-4 mr-2" />
              Templates
            </Button>
            <Button variant="outline" className="justify-start">
              <Icons.Share className="size-4 mr-2" />
              Share
            </Button>
            <Button variant="outline" className="justify-start">
              <Icons.Settings className="size-4 mr-2" />
              Settings
            </Button>
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Placeholder for dashboard cards */}
          <Card>
            <CardHeader>
              <CardTitle>Main Dashboard</CardTitle>
            </CardHeader>
            <CardContent>
              <P className="text-muted-foreground">
                Your primary home automation control center
              </P>
            </CardContent>
          </Card>

          <Card className="border-dashed">
            <CardHeader>
              <CardTitle>Create New Dashboard</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-center p-6">
              <Button variant="ghost" className="h-20 w-20">
                <Icons.Plus className="size-10" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute('/dashboards')({
  component: DashboardsPage,
});
