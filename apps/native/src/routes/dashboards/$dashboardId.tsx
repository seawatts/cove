import { api } from '@acme/api/client';
import { Button } from '@acme/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@acme/ui/card';
import { Icons } from '@acme/ui/icons';
import { H1, P, Text } from '@acme/ui/typography';
import { createFileRoute } from '@tanstack/react-router';

function DashboardPage() {
  const { dashboardId } = Route.useParams();
  const { data: dashboard } = api.useQuery(['dashboard', dashboardId]);

  if (!dashboard) {
    return (
      <div className="container py-16">
        <Card className="flex flex-col items-center justify-center gap-4 p-8 text-center">
          <Icons.AlertTriangle className="size-12 text-destructive" />
          <div className="space-y-2">
            <Text className="text-lg font-medium">Dashboard not found</Text>
            <Text className="text-sm text-muted-foreground">
              The dashboard you're looking for doesn't exist or has been removed
            </Text>
          </div>
          <Button variant="outline" onClick={() => history.back()}>
            <Icons.ArrowLeft className="size-4 mr-2" />
            Go Back
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-16">
      <div className="flex flex-col gap-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => history.back()}>
              <Icons.ArrowLeft className="size-4" />
              <span className="sr-only">Go back</span>
            </Button>
            <div>
              <H1>{dashboard.name}</H1>
              <P className="text-muted-foreground">
                {dashboard.description || 'No description'}
              </P>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Text className="text-sm text-muted-foreground">
              Last updated {new Date(dashboard.updated_at).toLocaleDateString()}
            </Text>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Dashboard Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Text className="font-medium">Layout</Text>
                <Text className="text-sm text-muted-foreground">
                  {dashboard.layout_type}
                </Text>
              </div>

              <div className="space-y-1">
                <Text className="font-medium">Widgets</Text>
                <Text className="text-sm text-muted-foreground">
                  {dashboard.widgets?.length || 0} widgets configured
                </Text>
              </div>

              <div className="space-y-1">
                <Text className="font-medium">Created</Text>
                <Text className="text-sm text-muted-foreground">
                  {new Date(dashboard.created_at).toLocaleString()}
                </Text>
              </div>

              <div className="space-y-1">
                <Text className="font-medium">Visibility</Text>
                <div className="flex items-center gap-2">
                  {dashboard.is_public ? (
                    <Icons.Globe2 className="size-4 text-primary" />
                  ) : (
                    <Icons.Lock className="size-4" />
                  )}
                  <Text className="text-sm text-muted-foreground">
                    {dashboard.is_public ? 'Public' : 'Private'}
                  </Text>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <Button variant="outline" className="justify-start">
                <Icons.LayoutDashboard className="size-4 mr-2" />
                Edit Layout
              </Button>
              <Button variant="outline" className="justify-start">
                <Icons.Share className="size-4 mr-2" />
                Share Dashboard
              </Button>
              <Button variant="outline" className="justify-start">
                <Icons.Copy className="size-4 mr-2" />
                Duplicate Dashboard
              </Button>
              <Button
                variant="outline"
                className="justify-start text-destructive"
              >
                <Icons.Delete className="size-4 mr-2" />
                Delete Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Widgets</CardTitle>
          </CardHeader>
          <CardContent>
            {!dashboard.widgets?.length ? (
              <div className="flex flex-col items-center justify-center gap-4 py-8 text-center">
                <Icons.LayoutDashboard className="size-12 text-muted-foreground" />
                <div className="space-y-2">
                  <Text className="text-lg font-medium">No widgets added</Text>
                  <Text className="text-sm text-muted-foreground">
                    Add your first widget to get started
                  </Text>
                </div>
                <Button>
                  <Icons.Plus className="size-4 mr-2" />
                  Add Widget
                </Button>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {dashboard.widgets.map((widget) => (
                  <Card key={widget.id}>
                    <CardHeader>
                      <CardTitle className="text-sm">{widget.name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Text className="text-sm text-muted-foreground">
                        {widget.type}
                      </Text>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export const Route = createFileRoute('/dashboards/$dashboardId')({
  component: DashboardPage,
});
