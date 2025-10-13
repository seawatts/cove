import { Button } from '@cove/ui/button';
import { Card, CardContent } from '@cove/ui/card';
import { Icons } from '@cove/ui/custom/icons';
import { H2, Text } from '@cove/ui/custom/typography';
import Link from 'next/link';

export default function AutomationsPage() {
  // TODO: Fetch automations from database
  const automations: Array<{
    id: string;
    name: string;
    enabled: boolean;
  }> = [];

  return (
    <div className="grid gap-6 p-6">
      <div className="grid grid-cols-[1fr_auto] items-center gap-4">
        <div className="grid gap-2">
          <H2>Automations</H2>
          <Text variant="muted">Create smart automations for your home</Text>
        </div>
        <Link href="/app/automations/new">
          <Button>
            <Icons.Plus size="sm" />
            Create Automation
          </Button>
        </Link>
      </div>

      {automations.length === 0 ? (
        <Card>
          <CardContent className="grid gap-4 p-8 items-center justify-center text-center">
            <Icons.Sparkles size="2xl" variant="muted" />
            <div className="grid gap-2">
              <Text>No automations yet</Text>
              <Text variant="muted">
                Create your first automation to make your home smarter
              </Text>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">{/* TODO: Render automations list */}</div>
      )}
    </div>
  );
}
