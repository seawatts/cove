import { Button } from '@cove/ui/button';
import { Card, CardContent } from '@cove/ui/card';
import { Icons } from '@cove/ui/custom/icons';
import { H2, Text } from '@cove/ui/custom/typography';
import { Link2 } from 'lucide-react';
import Link from 'next/link';

export default function HubSetupPage() {
  return (
    <div className="grid gap-6 p-6 max-w-4xl mx-auto">
      <div className="grid gap-2 text-center">
        <H2>Setup Your Cove Hub</H2>
        <Text variant="muted">
          Follow these steps to get your Raspberry Pi hub up and running
        </Text>
      </div>

      <div className="grid gap-4">
        <Card>
          <CardContent className="grid gap-4 p-6">
            <div className="grid gap-2">
              <div className="grid grid-cols-[32px_1fr] gap-4 items-start">
                <div className="size-8 rounded-full bg-primary text-primary-foreground grid items-center justify-center font-semibold">
                  1
                </div>
                <div className="grid gap-2">
                  <Text className="font-semibold">Download Hub Image</Text>
                  <Text className="text-sm" variant="muted">
                    Download the latest Cove hub image for Raspberry Pi
                  </Text>
                  <Link
                    href="https://github.com/seawatts/cove/releases/latest"
                    target="_blank"
                  >
                    <Button variant="outline">
                      <Icons.Download size="sm" />
                      Download Latest Release
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="grid gap-4 p-6">
            <div className="grid gap-2">
              <div className="grid grid-cols-[32px_1fr] gap-4 items-start">
                <div className="size-8 rounded-full bg-primary text-primary-foreground grid items-center justify-center font-semibold">
                  2
                </div>
                <div className="grid gap-2">
                  <Text className="font-semibold">Flash to SD Card</Text>
                  <Text className="text-sm" variant="muted">
                    Use Raspberry Pi Imager or Balena Etcher to flash the image
                    to an SD card
                  </Text>
                  <div className="grid grid-cols-2 gap-2">
                    <Link
                      href="https://www.raspberrypi.com/software/"
                      target="_blank"
                    >
                      <Button className="w-full" size="sm" variant="outline">
                        Raspberry Pi Imager
                      </Button>
                    </Link>
                    <Link href="https://etcher.balena.io/" target="_blank">
                      <Button className="w-full" size="sm" variant="outline">
                        Balena Etcher
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="grid gap-4 p-6">
            <div className="grid gap-2">
              <div className="grid grid-cols-[32px_1fr] gap-4 items-start">
                <div className="size-8 rounded-full bg-primary text-primary-foreground grid items-center justify-center font-semibold">
                  3
                </div>
                <div className="grid gap-2">
                  <Text className="font-semibold">Power On & Connect</Text>
                  <Text className="text-sm" variant="muted">
                    Insert the SD card into your Raspberry Pi and power it on.
                    The hub will boot and appear on your network as "Cove Hub"
                  </Text>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="grid gap-4 p-6">
            <div className="grid gap-2">
              <div className="grid grid-cols-[32px_1fr] gap-4 items-start">
                <div className="size-8 rounded-full bg-primary text-primary-foreground grid items-center justify-center font-semibold">
                  4
                </div>
                <div className="grid gap-2">
                  <Text className="font-semibold">Pair with Your Account</Text>
                  <Text className="text-sm" variant="muted">
                    Once the hub is online, pair it with your Cove account
                  </Text>
                  <Link href="/app/hub/pair">
                    <Button>
                      <Link2 className="size-4" />
                      Pair Hub Now
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
