import { api } from '@acme/api/client';
import { Button } from '@acme/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@acme/ui/card';
import { Icons } from '@acme/ui/icons';
import { H1, P, Text } from '@acme/ui/typography';
import { createFileRoute } from '@tanstack/react-router';

function DevicePage() {
  const { deviceId } = Route.useParams();
  const { data: device } = api.useQuery(['device', deviceId]);

  if (!device) {
    return (
      <div className="container py-16">
        <Card className="flex flex-col items-center justify-center gap-4 p-8 text-center">
          <Icons.AlertTriangle className="size-12 text-destructive" />
          <div className="flex flex-col gap-2">
            <Text className="text-lg font-medium">Device not found</Text>
            <Text className="text-sm text-muted-foreground">
              The device you're looking for doesn't exist or has been removed
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
              <H1>{device.friendly_name}</H1>
              <P className="text-muted-foreground">
                {device.location.room} • {device.protocol}
              </P>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {device.status === 'Online' ? (
              <Icons.CheckCircle2 className="size-4 text-primary" />
            ) : (
              <Icons.AlertCircle className="size-4 text-destructive" />
            )}
            <Text>{device.status}</Text>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Device Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="size-16 rounded-lg bg-muted p-4">
                  <img
                    src={device.metadata.icon_url}
                    alt=""
                    className="size-full object-contain"
                  />
                </div>
                <div className="space-y-1">
                  <Text className="font-medium">Protocol</Text>
                  <Text className="text-sm text-muted-foreground">
                    {device.protocol}
                  </Text>
                </div>
              </div>

              <div className="space-y-1">
                <Text className="font-medium">Location</Text>
                <Text className="text-sm text-muted-foreground">
                  {device.location.room}, {device.location.floor},{' '}
                  {device.location.zone}
                </Text>
              </div>

              <div className="space-y-1">
                <Text className="font-medium">Categories</Text>
                <div className="flex flex-wrap gap-2">
                  {device.categories.map((category) => (
                    <div
                      key={category}
                      className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium"
                    >
                      {category}
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <Text className="font-medium">Last Online</Text>
                <Text className="text-sm text-muted-foreground">
                  {new Date(device.last_online).toLocaleString()}
                </Text>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <Button variant="outline" className="justify-start">
                <Icons.SlidersHorizontal className="size-4 mr-2" />
                Configure Device
              </Button>
              <Button variant="outline" className="justify-start">
                <Icons.Share className="size-4 mr-2" />
                Share Device
              </Button>
              <Button
                variant="outline"
                className="justify-start text-destructive"
              >
                <Icons.Delete className="size-4 mr-2" />
                Remove Device
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute('/devices/$deviceId')({
  component: DevicePage,
});
