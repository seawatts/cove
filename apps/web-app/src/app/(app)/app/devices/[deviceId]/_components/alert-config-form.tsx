'use client';

import type {
  AlertConfig,
  AlertSeverity,
  AlertType,
  ThresholdOperator,
} from '@cove/types/alert';
import { Button } from '@cove/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@cove/ui/form';
import { Input } from '@cove/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@cove/ui/select';
import { Switch } from '@cove/ui/switch';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const alertConfigSchema = z
  .object({
    alertType: z.enum(['threshold', 'range', 'rate_of_change']),
    enabled: z.boolean(),
    field: z.string().min(1, 'Field is required'),
    name: z.string().min(1, 'Name is required'),
    rangeMax: z.number().optional(),

    // Range config
    rangeMin: z.number().optional(),

    // Rate of change config
    rateThreshold: z.number().optional(),
    rateWindow: z.number().optional(),
    severity: z.enum(['info', 'warning', 'critical']),
    thresholdOperator: z.enum(['gt', 'lt', 'gte', 'lte']).optional(),

    // Threshold config
    thresholdValue: z.number().optional(),
  })
  .superRefine((data, ctx) => {
    // Validate threshold config
    if (data.alertType === 'threshold') {
      if (!data.thresholdValue) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Threshold value is required',
          path: ['thresholdValue'],
        });
      }
      if (!data.thresholdOperator) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Threshold operator is required',
          path: ['thresholdOperator'],
        });
      }
    }

    // Validate range config
    if (data.alertType === 'range') {
      if (data.rangeMin === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Minimum value is required',
          path: ['rangeMin'],
        });
      }
      if (data.rangeMax === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Maximum value is required',
          path: ['rangeMax'],
        });
      }
      if (
        data.rangeMin !== undefined &&
        data.rangeMax !== undefined &&
        data.rangeMin >= data.rangeMax
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Minimum must be less than maximum',
          path: ['rangeMin'],
        });
      }
    }

    // Validate rate of change config
    if (data.alertType === 'rate_of_change') {
      if (!data.rateThreshold) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Rate threshold is required',
          path: ['rateThreshold'],
        });
      }
      if (!data.rateWindow) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Time window is required',
          path: ['rateWindow'],
        });
      }
    }
  });

type AlertConfigFormData = z.infer<typeof alertConfigSchema>;

interface AlertConfigFormProps {
  entityId: string;
  homeId: string;
  availableFields: string[];
  initialData?: Partial<AlertConfig>;
  onSubmit: (data: AlertConfigFormData) => Promise<void>;
  onCancel?: () => void;
}

export function AlertConfigForm({
  entityId: _entityId,
  homeId: _homeId,
  availableFields,
  initialData,
  onSubmit,
  onCancel,
}: AlertConfigFormProps) {
  const form = useForm<AlertConfigFormData, unknown, AlertConfigFormData>({
    defaultValues: {
      alertType: (initialData?.alertType as AlertType) || 'threshold',
      enabled: initialData?.enabled ?? true,
      field: initialData?.field || availableFields[0] || '',
      name: initialData?.name || '',
      rangeMax: initialData?.rangeMax,
      rangeMin: initialData?.rangeMin,
      rateThreshold: initialData?.rateThreshold,
      rateWindow: initialData?.rateWindow || 60000, // default 1 minute
      severity: (initialData?.severity as AlertSeverity) || 'warning',
      thresholdOperator:
        (initialData?.thresholdOperator as ThresholdOperator) || 'gt',
      thresholdValue: initialData?.thresholdValue,
    },
    resolver: zodResolver(alertConfigSchema),
  });

  const alertType = form.watch('alertType');

  const handleSubmit = async (data: AlertConfigFormData) => {
    try {
      await onSubmit(data);
      form.reset();
    } catch (error) {
      console.error('Error submitting alert config:', error);
    }
  };

  return (
    <Form {...form}>
      <form className="space-y-6" onSubmit={form.handleSubmit(handleSubmit)}>
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Alert Name</FormLabel>
              <FormControl>
                <Input placeholder="High CO2 Alert" {...field} />
              </FormControl>
              <FormDescription>
                A descriptive name for this alert
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="field"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Field to Monitor</FormLabel>
                <Select
                  defaultValue={field.value}
                  onValueChange={field.onChange}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select field" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {availableFields.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="severity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Severity</FormLabel>
                <Select
                  defaultValue={field.value}
                  onValueChange={field.onChange}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select severity" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="alertType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Alert Type</FormLabel>
              <Select defaultValue={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="threshold">Threshold</SelectItem>
                  <SelectItem value="range">Range</SelectItem>
                  <SelectItem value="rate_of_change">Rate of Change</SelectItem>
                </SelectContent>
              </Select>
              <FormDescription>
                {alertType === 'threshold' &&
                  'Trigger when value crosses a threshold'}
                {alertType === 'range' &&
                  'Trigger when value is outside a range'}
                {alertType === 'rate_of_change' &&
                  'Trigger when value changes too quickly'}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {alertType === 'threshold' && (
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="thresholdOperator"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Operator</FormLabel>
                  <Select
                    defaultValue={field.value}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select operator" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="gt">Greater than (&gt;)</SelectItem>
                      <SelectItem value="gte">
                        Greater than or equal (≥)
                      </SelectItem>
                      <SelectItem value="lt">Less than (&lt;)</SelectItem>
                      <SelectItem value="lte">
                        Less than or equal (≤)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="thresholdValue"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Threshold Value</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="1000"
                      type="number"
                      {...field}
                      onChange={(e) => field.onChange(e.target.valueAsNumber)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}

        {alertType === 'range' && (
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="rangeMin"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Minimum Value</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="400"
                      type="number"
                      {...field}
                      onChange={(e) => field.onChange(e.target.valueAsNumber)}
                    />
                  </FormControl>
                  <FormDescription>Alert when below this value</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="rangeMax"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Maximum Value</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="1000"
                      type="number"
                      {...field}
                      onChange={(e) => field.onChange(e.target.valueAsNumber)}
                    />
                  </FormControl>
                  <FormDescription>Alert when above this value</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}

        {alertType === 'rate_of_change' && (
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="rateThreshold"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rate Threshold</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="10"
                      type="number"
                      {...field}
                      onChange={(e) => field.onChange(e.target.valueAsNumber)}
                    />
                  </FormControl>
                  <FormDescription>Change per second</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="rateWindow"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Time Window (ms)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="60000"
                      type="number"
                      {...field}
                      onChange={(e) => field.onChange(e.target.valueAsNumber)}
                    />
                  </FormControl>
                  <FormDescription>Time period to measure rate</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}

        <FormField
          control={form.control}
          name="enabled"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">Enable Alert</FormLabel>
                <FormDescription>
                  Alert will only trigger when enabled
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

        <div className="flex justify-end gap-3">
          {onCancel && (
            <Button onClick={onCancel} type="button" variant="outline">
              Cancel
            </Button>
          )}
          <Button disabled={form.formState.isSubmitting} type="submit">
            {form.formState.isSubmitting ? 'Saving...' : 'Save Alert'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
