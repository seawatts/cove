'use client';

import { Button } from '@cove/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@cove/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from '@cove/ui/form';
import { Switch } from '@cove/ui/switch';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { useUserPreferences } from '../../../_components/user-preferences-provider';

const preferencesSchema = z.object({
  syncTooltips: z.boolean(),
});

type PreferencesFormValues = z.infer<typeof preferencesSchema>;

export function PreferencesForm() {
  const { preferences, updatePreferences, isLoading } = useUserPreferences();

  const form = useForm<PreferencesFormValues>({
    defaultValues: {
      syncTooltips: preferences.syncTooltips ?? true,
    },
    resolver: zodResolver(preferencesSchema),
    values: {
      syncTooltips: preferences.syncTooltips ?? true,
    },
  });

  async function onSubmit(data: PreferencesFormValues) {
    try {
      await updatePreferences(data);
      toast.success('Preferences updated successfully');
    } catch (error) {
      console.error('Failed to update preferences:', error);
      toast.error('Failed to update preferences. Please try again.');
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading...</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-20 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Form {...form}>
      <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
        <Card>
          <CardHeader>
            <CardTitle>Chart Preferences</CardTitle>
            <CardDescription>
              Configure how sensor charts behave on device pages
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="syncTooltips"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">
                      Sync Chart Tooltips
                    </FormLabel>
                    <FormDescription>
                      When enabled, hovering over one chart will show tooltips
                      on all charts at the same time position. This helps
                      compare sensor readings across multiple charts.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button
            disabled={form.formState.isSubmitting || !form.formState.isDirty}
            type="submit"
          >
            {form.formState.isSubmitting ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
