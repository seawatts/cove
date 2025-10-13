'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@cove/ui/card';
import { Text } from '@cove/ui/custom/typography';

export function HubLogs() {
  // TODO: Fetch real logs from hub API or Supabase
  const logs: Array<{
    id: string;
    timestamp: Date;
    level: string;
    message: string;
  }> = [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <Text className="text-center py-8" variant="muted">
            No recent activity
          </Text>
        ) : (
          <div className="grid gap-2">
            {logs.map((log) => (
              <div
                className="grid grid-cols-[auto_1fr] gap-4 p-2 border-l-2 border-primary"
                key={log.id}
              >
                <Text className="text-xs font-mono" variant="muted">
                  {log.timestamp.toLocaleTimeString()}
                </Text>
                <Text className="text-sm">{log.message}</Text>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
