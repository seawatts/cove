import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { QrScanner } from '@yudiel/react-qr-scanner';
import type React from 'react';
import { useState } from 'react';

interface HomeKitSetupCode {
  setupCode: string;
  deviceId: string;
  category: number;
}

// HomeKit QR code format: X-HM://[category]?[setup-code]&[device-id]
function parseHomeKitQR(qrData: string): HomeKitSetupCode | null {
  try {
    const url = new URL(qrData.replace('X-HM:', ''));
    const category = Number.parseInt(url.pathname.slice(2), 10);
    const setupCode = url.searchParams.get('') || '';
    const deviceId = url.searchParams.get('id') || '';

    if (!setupCode || !deviceId) return null;

    return {
      setupCode,
      deviceId,
      category,
    };
  } catch (e) {
    console.error('Failed to parse HomeKit QR code:', e);
    return null;
  }
}

interface HomeKitScannerProps {
  onDeviceFound: (device: {
    setupCode: string;
    deviceId: string;
    name: string;
    model: string;
  }) => Promise<void>;
}

export function HomeKitScanner({ onDeviceFound }: HomeKitScannerProps) {
  const [scanning, setScanning] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const { toast } = useToast();

  const handleScan = async (data: string | null) => {
    if (!data) return;

    const setupInfo = parseHomeKitQR(data);
    if (!setupInfo) {
      toast({
        title: 'Invalid QR Code',
        description: 'This does not appear to be a valid HomeKit setup code.',
        variant: 'destructive',
      });
      return;
    }

    // For U100, category should be 6 (Lock)
    if (setupInfo.category !== 6) {
      toast({
        title: 'Unsupported Device',
        description: 'This QR code is not for a lock device.',
        variant: 'destructive',
      });
      return;
    }

    await onDeviceFound({
      setupCode: setupInfo.setupCode,
      deviceId: setupInfo.deviceId,
      name: deviceName || 'New Lock',
      model: 'U100',
    });
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.match(/^\d{3}-\d{2}-\d{3}$/)) {
      toast({
        title: 'Invalid Setup Code',
        description: 'Please enter the code in XXX-XX-XXX format.',
        variant: 'destructive',
      });
      return;
    }

    await onDeviceFound({
      setupCode: manualCode,
      deviceId: `manual-${Date.now()}`,
      name: deviceName || 'New Lock',
      model: 'U100',
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="deviceName">Device Name</Label>
        <Input
          id="deviceName"
          placeholder="e.g., Front Door"
          value={deviceName}
          onChange={(e) => setDeviceName(e.target.value)}
        />
      </div>

      {scanning ? (
        <div className="relative aspect-square max-w-md mx-auto">
          <QrScanner
            onDecode={handleScan}
            onError={(error) => console.error(error)}
          />
          <Button
            variant="secondary"
            className="absolute bottom-4 right-4"
            onClick={() => setScanning(false)}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <Button onClick={() => setScanning(true)}>Scan QR Code</Button>
      )}

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            Or enter manually
          </span>
        </div>
      </div>

      <form onSubmit={handleManualSubmit} className="space-y-2">
        <Label htmlFor="setupCode">Setup Code</Label>
        <Input
          id="setupCode"
          placeholder="XXX-XX-XXX"
          value={manualCode}
          onChange={(e) => setManualCode(e.target.value)}
          pattern="\d{3}-\d{2}-\d{3}"
        />
        <Button type="submit" className="w-full">
          Add Device
        </Button>
      </form>
    </div>
  );
}
