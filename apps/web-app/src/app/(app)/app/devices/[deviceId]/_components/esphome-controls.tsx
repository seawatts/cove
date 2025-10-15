'use client';

import { api } from '@cove/api/react';
import { Button } from '@cove/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@cove/ui/card';
import { Icons } from '@cove/ui/custom/icons';
import { Text } from '@cove/ui/custom/typography';
import { Label } from '@cove/ui/label';
import { Slider } from '@cove/ui/slider';
import { Switch } from '@cove/ui/switch';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface ESPHomeControlsProps {
  deviceId: string;
}

interface LightState {
  brightness?: number;
  state: boolean;
}

interface Entity {
  id: string;
  key: number;
  name: string;
  entityType: string;
  unitOfMeasurement?: string;
  minValue?: number;
  maxValue?: number;
  step?: number;
  supportsBrightness?: boolean;
  supportsRgb?: boolean;
  effects?: string[];
  currentValue?: unknown;
}

export function ESPHomeControls({ deviceId }: ESPHomeControlsProps) {
  const { data: entities = [] } = api.esphome.getEntities.useQuery({
    deviceId,
  });

  const buttons = entities.filter((e) => e.entityType === 'button');
  const numbers = entities.filter((e) => e.entityType === 'number');
  const lights = entities.filter((e) => e.entityType === 'light');

  return (
    <div className="grid gap-4">
      {buttons.length > 0 && (
        <ButtonControls buttons={buttons} deviceId={deviceId} />
      )}
      {numbers.length > 0 && (
        <NumberControls deviceId={deviceId} numbers={numbers} />
      )}
      {lights.length > 0 && (
        <LightControls deviceId={deviceId} lights={lights} />
      )}
    </div>
  );
}

interface ButtonControlsProps {
  deviceId: string;
  buttons: Entity[];
}

function ButtonControls({ deviceId, buttons }: ButtonControlsProps) {
  const pressButton = api.esphome.pressButton.useMutation();

  const handlePress = async (entityKey: number, name: string) => {
    try {
      await pressButton.mutateAsync({ deviceId, entityKey });
      toast.success(`${name} activated`);
    } catch (_error) {
      toast.error(`Failed to press ${name}`);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Actions</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2">
        {buttons.map((button) => (
          <Button
            disabled={pressButton.isPending}
            key={button.id}
            onClick={() => handlePress(button.key, button.name)}
            variant="outline"
          >
            <Icons.Circle size="sm" />
            {button.name}
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}

interface NumberControlsProps {
  deviceId: string;
  numbers: Entity[];
}

function NumberControls({ deviceId, numbers }: NumberControlsProps) {
  const setNumber = api.esphome.setNumber.useMutation();
  const [values, setValues] = useState<Record<number, number>>({});

  // Initialize values from current entity values
  useEffect(() => {
    const initialValues: Record<number, number> = {};
    numbers.forEach((num) => {
      if (num.currentValue !== null && num.currentValue !== undefined) {
        initialValues[num.key] = Number(num.currentValue);
      } else if (num.minValue !== null && num.minValue !== undefined) {
        initialValues[num.key] = num.minValue;
      }
    });
    setValues(initialValues);
  }, [numbers]);

  const handleChange = async (
    entityKey: number,
    value: number,
    name: string,
  ) => {
    setValues((prev) => ({ ...prev, [entityKey]: value }));

    try {
      await setNumber.mutateAsync({ deviceId, entityKey, value });
    } catch (_error) {
      toast.error(`Failed to update ${name}`);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Settings</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {numbers.map((num) => {
          const currentValue =
            values[num.key] ?? num.currentValue ?? num.minValue ?? 0;

          return (
            <div className="grid gap-2" key={num.id}>
              <div className="flex items-center justify-between">
                <Label>{num.name}</Label>
                <Text className="text-sm" variant="muted">
                  {currentValue} {num.unitOfMeasurement || ''}
                </Text>
              </div>
              <Slider
                disabled={setNumber.isPending}
                max={num.maxValue ?? 100}
                min={num.minValue ?? 0}
                onValueChange={([val]) => handleChange(num.key, val, num.name)}
                step={num.step ?? 1}
                value={[currentValue]}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{num.minValue}</span>
                <span>{num.maxValue}</span>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

interface LightControlsProps {
  deviceId: string;
  lights: Entity[];
}

function LightControls({ deviceId, lights }: LightControlsProps) {
  const controlLight = api.esphome.controlLight.useMutation();
  const [states, setStates] = useState<Record<number, LightState>>({});

  // Initialize light states from current values
  useEffect(() => {
    const initialStates: Record<number, LightState> = {};
    lights.forEach((light) => {
      if (light.currentValue && typeof light.currentValue === 'object') {
        initialStates[light.key] = light.currentValue as LightState;
      } else {
        initialStates[light.key] = { brightness: 1, state: false };
      }
    });
    setStates(initialStates);
  }, [lights]);

  const handleToggle = async (entityKey: number, name: string) => {
    const currentState = states[entityKey] || { state: false };
    const newState = !currentState.state;

    setStates((prev) => ({
      ...prev,
      [entityKey]: { ...currentState, state: newState },
    }));

    try {
      await controlLight.mutateAsync({
        command: { state: newState },
        deviceId,
        entityKey,
      });
    } catch (_error) {
      toast.error(`Failed to toggle ${name}`);
      // Revert state on error
      setStates((prev) => ({
        ...prev,
        [entityKey]: { ...currentState, state: currentState.state },
      }));
    }
  };

  const handleBrightnessChange = async (
    entityKey: number,
    brightness: number,
    name: string,
  ) => {
    const currentState = states[entityKey] || { brightness: 1, state: false };

    setStates((prev) => ({
      ...prev,
      [entityKey]: { ...currentState, brightness, state: brightness > 0 },
    }));

    try {
      await controlLight.mutateAsync({
        command: { brightness, state: brightness > 0 },
        deviceId,
        entityKey,
      });
    } catch (_error) {
      toast.error(`Failed to update ${name} brightness`);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lights</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {lights.map((light) => {
          const lightState = states[light.key] || {
            brightness: 1,
            state: false,
          };
          const isOn = lightState.state;

          return (
            <div className="grid gap-4" key={light.id}>
              <div className="flex items-center justify-between">
                <Label htmlFor={`light-${light.id}`}>{light.name}</Label>
                <Switch
                  checked={isOn}
                  disabled={controlLight.isPending}
                  id={`light-${light.id}`}
                  onCheckedChange={() => handleToggle(light.key, light.name)}
                />
              </div>

              {isOn && light.supportsBrightness && (
                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <Label>Brightness</Label>
                    <Text className="text-sm" variant="muted">
                      {Math.round((lightState.brightness || 1) * 100)}%
                    </Text>
                  </div>
                  <Slider
                    disabled={controlLight.isPending}
                    max={1}
                    min={0.01}
                    onValueChange={([brightness]) =>
                      handleBrightnessChange(light.key, brightness, light.name)
                    }
                    step={0.01}
                    value={[lightState.brightness || 1]}
                  />
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
