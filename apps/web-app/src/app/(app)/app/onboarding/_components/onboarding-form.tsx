'use client';

import { useUser } from '@clerk/nextjs';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@cove/ui/card';
import { Button } from '@cove/ui/components/button';
import { Icons } from '@cove/ui/custom/icons';
import { toast } from '@cove/ui/sonner';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface OnboardingFormProps {
  isLoading?: boolean;
  redirectTo?: string;
  source?: string;
}

export function OnboardingForm({
  isLoading = false,
  redirectTo,
}: OnboardingFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useUser();

  const handleSubmit = async () => {
    if (!user) {
      toast.error('No user found');
      return;
    }

    setIsSubmitting(true);

    try {
      // Simplified onboarding for home-centric architecture
      toast.success('Onboarding completed! Welcome to Cove.');

      // Redirect to dashboard
      router.push(redirectTo ?? '/app/dashboard');
    } catch (error) {
      console.error('Onboarding error:', error);
      toast.error('Failed to complete onboarding. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-12rem)] items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-2xl">Welcome to Cove</CardTitle>
          <CardDescription>
            Let's get your home automation system set up
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          <div className="grid gap-4">
            <div className="text-center">
              <Icons.Home
                className="mx-auto mb-4"
                size="xl"
                variant="primary"
              />
              <h3 className="text-lg font-semibold">
                Home-Centric Architecture
              </h3>
              <p className="text-muted-foreground">
                Cove organizes everything around your home, making it easier to
                manage your devices, rooms, and automations.
              </p>
            </div>

            <div className="grid gap-2">
              <h4 className="font-medium">What's included:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Device discovery and management</li>
                <li>• Room organization</li>
                <li>• Automation rules</li>
                <li>• Real-time monitoring</li>
              </ul>
            </div>
          </div>

          <Button
            className="w-full"
            disabled={isSubmitting || isLoading}
            onClick={handleSubmit}
            size="lg"
          >
            {isSubmitting ? (
              <>
                <Icons.Spinner className="animate-spin" size="sm" />
                Setting up...
              </>
            ) : (
              <>
                <Icons.Check size="sm" />
                Get Started
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
