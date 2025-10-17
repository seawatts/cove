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
  entities: Array<{
    entityId: string;
    kind: string;
    key: string;
    name: string;
    traits: Record<string, unknown>;
    state?: {
      state: string;
      attrs?: Record<string, unknown>;
      updatedAt: Date;
    };
  }>;
}

interface LightState {
  brightness?: number;
  state: boolean;
}

export function ESPHomeControls({ deviceId, entities }: ESPHomeControlsProps) {
  // Filter entities by type
  const buttons = entities.filter((e) => e.kind === 'button');
  const numbers = entities.filter((e) => e.kind === 'number');
  const lights = entities.filter((e) => e.kind === 'light');
  const switches = entities.filter((e) => e.kind === 'switch');

  return (
    <div className="grid gap-4">
      {buttons.length > 0 && (
        <ButtonControls buttons={buttons} deviceId={deviceId} />
      )}
      {switches.length > 0 && (
        <SwitchControls deviceId={deviceId} switches={switches} />
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
  buttons: Array<{
    entityId: string;
    key: string;
    name: string;
  }>;
}

function ButtonControls({ buttons }: ButtonControlsProps) {
  const pressButton = api.entity.sendCommand.useMutation();

  const handlePress = async (entityId: string, name: string) => {
    try {
      await pressButton.mutateAsync({
        capability: 'press',
        entityId,
        value: true,
      });
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
            key={button.entityId}
            onClick={() => handlePress(button.entityId, button.name)}
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

interface SwitchControlsProps {
  deviceId: string;
  switches: Array<{
    entityId: string;
    key: string;
    name: string;
    state?: {
      state: string;
      attrs?: Record<string, unknown>;
    };
  }>;
}

function SwitchControls({ switches }: SwitchControlsProps) {
  const toggleSwitch = api.entity.sendCommand.useMutation();
  const [states, setStates] = useState<Record<string, boolean>>({});

  // Initialize switch states from entity states
  useEffect(() => {
    const initialStates: Record<string, boolean> = {};
    switches.forEach((switchEntity) => {
      initialStates[switchEntity.entityId] = switchEntity.state?.state === 'on';
    });
    setStates(initialStates);
  }, [switches]);

  const handleToggle = async (entityId: string, name: string) => {
    const currentState = states[entityId] || false;
    const newState = !currentState;

    setStates((prev) => ({
      ...prev,
      [entityId]: newState,
    }));

    try {
      await toggleSwitch.mutateAsync({
        capability: 'on_off',
        entityId,
        value: newState,
      });
    } catch (_error) {
      toast.error(`Failed to toggle ${name}`);
      // Revert state on error
      setStates((prev) => ({
        ...prev,
        [entityId]: currentState,
      }));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Switches</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {switches.map((switchEntity) => {
          const isOn = states[switchEntity.entityId] || false;

          return (
            <div
              className="flex items-center justify-between"
              key={switchEntity.entityId}
            >
              <Label htmlFor={`switch-${switchEntity.entityId}`}>
                {switchEntity.name}
              </Label>
              <Switch
                checked={isOn}
                disabled={toggleSwitch.isPending}
                id={`switch-${switchEntity.entityId}`}
                onCheckedChange={() =>
                  handleToggle(switchEntity.entityId, switchEntity.name)
                }
              />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

interface NumberControlsProps {
  deviceId: string;
  numbers: Array<{
    entityId: string;
    key: string;
    name: string;
    traits: Record<string, unknown>;
    state?: {
      state: string;
      attrs?: Record<string, unknown>;
    };
  }>;
}

function NumberControls({ numbers }: NumberControlsProps) {
  const setNumber = api.entity.sendCommand.useMutation();
  const [values, setValues] = useState<Record<string, number>>({});

  // Initialize values from current entity values
  useEffect(() => {
    const initialValues: Record<string, number> = {};
    numbers.forEach((num) => {
      const currentValue = num.state?.state;
      if (currentValue !== null && currentValue !== undefined) {
        initialValues[num.entityId] = Number(currentValue);
      } else {
        // Use min value from traits as default
        const minValue = num.traits.min_value as number;
        initialValues[num.entityId] = minValue || 0;
      }
    });
    setValues(initialValues);
  }, [numbers]);

  const handleChange = async (
    entityId: string,
    value: number,
    name: string,
  ) => {
    setValues((prev) => ({ ...prev, [entityId]: value }));

    try {
      await setNumber.mutateAsync({
        capability: 'value',
        entityId,
        value,
      });
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
          const minValue = (num.traits.min_value as number) || 0;
          const maxValue = (num.traits.max_value as number) || 100;
          const step = (num.traits.step as number) || 1;
          const unit = (num.traits.unit_of_measurement as string) || '';
          const currentValue =
            values[num.entityId] ?? Number(num.state?.state) ?? minValue;

          return (
            <div className="grid gap-2" key={num.entityId}>
              <div className="flex items-center justify-between">
                <Label>{num.name}</Label>
                <Text className="text-sm" variant="muted">
                  {currentValue} {unit}
                </Text>
              </div>
              <Slider
                disabled={setNumber.isPending}
                max={maxValue}
                min={minValue}
                onValueChange={([val]) =>
                  handleChange(num.entityId, val, num.name)
                }
                step={step}
                value={[currentValue]}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{minValue}</span>
                <span>{maxValue}</span>
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
  lights: Array<{
    entityId: string;
    key: string;
    name: string;
    traits: Record<string, unknown>;
    state?: {
      state: string;
      attrs?: Record<string, unknown>;
    };
  }>;
}

function LightControls({ lights }: LightControlsProps) {
  const controlLight = api.entity.sendCommand.useMutation();
  const [states, setStates] = useState<Record<string, LightState>>({});

  // Initialize light states from current values
  useEffect(() => {
    const initialStates: Record<string, LightState> = {};
    lights.forEach((light) => {
      const isOn = light.state?.state === 'on';
      const brightness = (light.state?.attrs?.brightness as number) || 1;
      initialStates[light.entityId] = {
        brightness: isOn ? brightness : 0,
        state: isOn,
      };
    });
    setStates(initialStates);
  }, [lights]);

  const handleToggle = async (entityId: string, name: string) => {
    const currentState = states[entityId] || { state: false };
    const newState = !currentState.state;

    setStates((prev) => ({
      ...prev,
      [entityId]: { ...currentState, state: newState },
    }));

    try {
      await controlLight.mutateAsync({
        capability: 'on_off',
        entityId,
        value: newState,
      });
    } catch (_error) {
      toast.error(`Failed to toggle ${name}`);
      // Revert state on error
      setStates((prev) => ({
        ...prev,
        [entityId]: { ...currentState, state: currentState.state },
      }));
    }
  };

  const handleBrightnessChange = async (
    entityId: string,
    brightness: number,
    name: string,
  ) => {
    const currentState = states[entityId] || { brightness: 1, state: false };

    setStates((prev) => ({
      ...prev,
      [entityId]: { ...currentState, brightness, state: brightness > 0 },
    }));

    try {
      await controlLight.mutateAsync({
        capability: 'brightness',
        entityId,
        value: brightness,
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
          const lightState = states[light.entityId] || {
            brightness: 1,
            state: false,
          };
          const isOn = lightState.state;
          const supportsBrightness = light.traits
            .supports_brightness as boolean;

          return (
            <div className="grid gap-4" key={light.entityId}>
              <div className="flex items-center justify-between">
                <Label htmlFor={`light-${light.entityId}`}>{light.name}</Label>
                <Switch
                  checked={isOn}
                  disabled={controlLight.isPending}
                  id={`light-${light.entityId}`}
                  onCheckedChange={() =>
                    handleToggle(light.entityId, light.name)
                  }
                />
              </div>

              {isOn && supportsBrightness && (
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
                      handleBrightnessChange(
                        light.entityId,
                        brightness,
                        light.name,
                      )
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
