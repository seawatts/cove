'use client';

import { api } from '@cove/api/react';
import { Button } from '@cove/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@cove/ui/card';
import { Text } from '@cove/ui/custom/typography';
import { Label } from '@cove/ui/label';
import { Slider } from '@cove/ui/slider';
import { Switch } from '@cove/ui/switch';
import { useEffect, useState } from 'react';

interface HueLightControlsProps {
  deviceId: string;
  lightState: {
    on?: boolean;
    brightness?: number; // 0-100
    color_temp?: number; // mireds
    hue?: number; // 0-65535
    saturation?: number; // 0-254
  };
}

export function HueLightControls({
  deviceId,
  lightState,
}: HueLightControlsProps) {
  const [isOn, setIsOn] = useState(lightState.on ?? false);
  const [brightness, setBrightness] = useState(lightState.brightness ?? 100);
  const [colorTemp, setColorTemp] = useState(lightState.color_temp ?? 366);
  const [hue, setHue] = useState(
    lightState.hue ? Math.round((lightState.hue / 65535) * 360) : 0,
  );
  const [saturation, setSaturation] = useState(
    lightState.saturation ? Math.round((lightState.saturation / 254) * 100) : 0,
  );

  const controlMutation = api.hue.controlLight.useMutation();

  // Sync with prop changes
  useEffect(() => {
    setIsOn(lightState.on ?? false);
    setBrightness(lightState.brightness ?? 100);
    setColorTemp(lightState.color_temp ?? 366);
    if (lightState.hue) {
      setHue(Math.round((lightState.hue / 65535) * 360));
    }
    if (lightState.saturation) {
      setSaturation(Math.round((lightState.saturation / 254) * 100));
    }
  }, [lightState]);

  const handleToggle = async (on: boolean) => {
    setIsOn(on);
    try {
      await controlMutation.mutateAsync({
        command: { on },
        lightId: deviceId,
      });
    } catch (_error) {
      // Revert on error
      setIsOn(!on);
    }
  };

  const handleBrightnessChange = async (value: number[]) => {
    const newBrightness = value[0];
    if (newBrightness === undefined) return;
    setBrightness(newBrightness);
    try {
      await controlMutation.mutateAsync({
        command: { brightness: newBrightness },
        lightId: deviceId,
      });
    } catch (_error) {
      // Silently fail or show toast
    }
  };

  const handleColorTempChange = async (value: number[]) => {
    const newTemp = value[0];
    if (newTemp === undefined) return;
    setColorTemp(newTemp);
    try {
      await controlMutation.mutateAsync({
        command: { colorTemp: newTemp },
        lightId: deviceId,
      });
    } catch (_error) {
      // Silently fail
    }
  };

  const handleColorChange = async () => {
    try {
      // Convert 0-360 hue to 0-65535
      const hueValue = Math.round((hue / 360) * 65535);
      // Convert 0-100 saturation to 0-254
      const satValue = Math.round((saturation / 100) * 254);

      await controlMutation.mutateAsync({
        command: { hue: hueValue, saturation: satValue },
        lightId: deviceId,
      });
    } catch (_error) {
      // Silently fail
    }
  };

  // Convert mireds to Kelvin for display
  const kelvin = Math.round(1000000 / colorTemp);

  // HSV to RGB for color preview
  const hsvToRgb = (hue: number, sat: number, val: number) => {
    const h = hue / 360;
    const s = sat / 100;
    const v = val / 100;
    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);

    let r = 0;
    let g = 0;
    let b = 0;
    switch (i % 6) {
      case 0:
        r = v;
        g = t;
        b = p;
        break;
      case 1:
        r = q;
        g = v;
        b = p;
        break;
      case 2:
        r = p;
        g = v;
        b = t;
        break;
      case 3:
        r = p;
        g = q;
        b = v;
        break;
      case 4:
        r = t;
        g = p;
        b = v;
        break;
      case 5:
        r = v;
        g = p;
        b = q;
        break;
    }

    return {
      b: Math.round(b * 255),
      g: Math.round(g * 255),
      r: Math.round(r * 255),
    };
  };

  const currentColor = hsvToRgb(hue, saturation, 100);
  const colorPreview = `rgb(${currentColor.r}, ${currentColor.g}, ${currentColor.b})`;

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Power</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="power-toggle">Light Power</Label>
            <Switch
              checked={isOn}
              disabled={controlMutation.isPending}
              id="power-toggle"
              onCheckedChange={handleToggle}
            />
          </div>
          <Text className="text-sm" variant="muted">
            {isOn ? 'Light is on' : 'Light is off'}
          </Text>
        </CardContent>
      </Card>

      {isOn && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Brightness</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label>Level</Label>
                  <Text className="text-sm" variant="muted">
                    {brightness}%
                  </Text>
                </div>
                <Slider
                  disabled={controlMutation.isPending}
                  max={100}
                  min={1}
                  onValueChange={handleBrightnessChange}
                  step={1}
                  value={[brightness]}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Color</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label>Hue</Label>
                  <Text className="text-sm" variant="muted">
                    {hue}°
                  </Text>
                </div>
                <Slider
                  disabled={controlMutation.isPending}
                  max={360}
                  min={0}
                  onValueChange={(value) => {
                    if (value[0] !== undefined) setHue(value[0]);
                  }}
                  onValueCommit={handleColorChange}
                  step={1}
                  value={[hue]}
                />
              </div>

              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label>Saturation</Label>
                  <Text className="text-sm" variant="muted">
                    {saturation}%
                  </Text>
                </div>
                <Slider
                  disabled={controlMutation.isPending}
                  max={100}
                  min={0}
                  onValueChange={(value) => {
                    if (value[0] !== undefined) setSaturation(value[0]);
                  }}
                  onValueCommit={handleColorChange}
                  step={1}
                  value={[saturation]}
                />
              </div>

              <div className="grid gap-2">
                <Label>Preview</Label>
                <div
                  className="h-12 rounded-md border"
                  style={{ backgroundColor: colorPreview }}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Color Temperature</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label>Temperature</Label>
                  <Text className="text-sm" variant="muted">
                    {kelvin}K
                  </Text>
                </div>
                <Slider
                  disabled={controlMutation.isPending}
                  max={500} // 2000K (warm)
                  min={153} // 6500K (cool)
                  onValueChange={handleColorTempChange}
                  step={1}
                  value={[colorTemp]}
                />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Cool (6500K)</span>
                  <span>Warm (2000K)</span>
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Quick Presets</Label>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    onClick={() => handleColorTempChange([153])}
                    size="sm"
                    variant="outline"
                  >
                    Cool
                  </Button>
                  <Button
                    onClick={() => handleColorTempChange([326])}
                    size="sm"
                    variant="outline"
                  >
                    Neutral
                  </Button>
                  <Button
                    onClick={() => handleColorTempChange([500])}
                    size="sm"
                    variant="outline"
                  >
                    Warm
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
