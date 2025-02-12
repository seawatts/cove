import { api } from '@acme/api/client';
import { Button } from '@acme/ui/button';
import { Card } from '@acme/ui/card';
import { Icons } from '@acme/ui/icons';
import { Text } from '@acme/ui/typography';
import { Link } from '@tanstack/react-router';

type Dashboard = {
  id: string;
  name: string;
  description: string | null;
  layout_type: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  widgets: Array<{
    id: string;
    name: string;
    type: string;
  }>;
};

export function DashboardsTable() {
  const { data: dashboards } = api.useQuery(['dashboards']);

  if (!dashboards?.length) {
    return (
      <Card className="flex flex-col items-center justify-center gap-4 p-8 text-center">
        <Icons.LayoutDashboard className="size-12 text-muted-foreground" />
        <div className="space-y-2">
          <Text className="text-lg font-medium">No dashboards found</Text>
          <Text className="text-sm text-muted-foreground">
            Create your first dashboard to get started
          </Text>
        </div>
        <Button>
          <Icons.Plus className="size-4 mr-2" />
          Create Dashboard
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {dashboards.map((dashboard) => (
        <Link
          key={dashboard.id}
          to="/dashboards/$dashboardId"
          params={{ dashboardId: dashboard.id }}
          className="block"
        >
          <Card className="p-4 transition-colors hover:bg-muted/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="size-10 rounded-lg bg-muted p-2">
                  <Icons.LayoutDashboard className="size-full text-foreground/60" />
                </div>
                <div>
                  <Text className="font-medium">{dashboard.name}</Text>
                  <Text className="text-sm text-muted-foreground">
                    {dashboard.description || 'No description'} •{' '}
                    {dashboard.widgets.length} widgets
                  </Text>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  {dashboard.is_public ? (
                    <Icons.Globe2 className="size-4 text-primary" />
                  ) : (
                    <Icons.Lock className="size-4" />
                  )}
                  <Text className="text-sm">
                    {dashboard.is_public ? 'Public' : 'Private'}
                  </Text>
                </div>
                <Button variant="ghost" size="icon">
                  <Icons.MoreVertical className="size-4" />
                  <span className="sr-only">More options</span>
                </Button>
              </div>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}
