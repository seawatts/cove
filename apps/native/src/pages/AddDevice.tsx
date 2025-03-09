import { HomeKitScanner } from '@/components/HomeKitScanner';
import { useToast } from '@/components/ui/use-toast';
import { useState } from 'react';

export function AddDevicePage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handleDeviceFound = async (device: {
    setupCode: string;
    deviceId: string;
    name: string;
    model: string;
  }) => {
    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:3000/api/homekit/pair', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(device),
      });

      const data = await response.json();
      if (data.success) {
        toast({
          title: 'Device Added',
          description: `Successfully added ${device.name} to your home.`,
        });
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to add device',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-8">Add New Device</h1>
      <div className="max-w-md mx-auto bg-card p-6 rounded-lg shadow-lg">
        <HomeKitScanner onDeviceFound={handleDeviceFound} />
      </div>
    </div>
  );
}
