# Cove Platform Architecture

## Use Cases

- **Startup & Initialization:**
  - Startup Sequence
  - Initialize Integrations
- **Device Management:**
  - Discover Devices
  - Get Device State (Poll & Subscribe)
  - Send Device Command
  - Handle Device Shadow States & Simulation
- **Live Media:**
  - View Live Stream from Camera
- **Data Storage:**
  - Store Sensor Time Series Data
  - Store Device State History
  - Store Device Events


## Get Device State (Poll, Subscribe)

```mermaid
sequenceDiagram
    participant Api
    participant Platform
    participant DeviceRegistry as "Device Registry"
    participant EventBus as "Event Bus"
    participant Integrations
    participant Device

    Api->>Platform: Get Device State (deviceId)
    Platform->>DeviceRegistry: Lookup Device (deviceId)
    DeviceRegistry->>Platform: Return integrationId & Cached State
    Platform->>DeviceRegistry: Request Latest State Update
    DeviceRegistry->>Integrations: Fetch Latest Device State (deviceId)
    Integrations->>Device: Query Device State
    Device->>Integrations: Return Current State
    Integrations->>DeviceRegistry: Update Cached State

    par Notify State Change
        DeviceRegistry->>EventBus: Publish State Changed Event
        EventBus->>Platform: Forward State Event
        Platform->>Api: Return Updated State
    and Update Subscribers
        EventBus->>Subscribers: Notify State Change to Subscribers
    end
```

## Command Sequence

```mermaid
sequenceDiagram
    participant Api
    participant Platform
    participant DeviceRegistry as "Device Registry"
    participant EventBus as "Event Bus"
    participant Integrations
    participant Device

    Api->>Platform: Send Device Command (deviceId, command)
    Platform->>DeviceRegistry: Lookup Device (deviceId)
    DeviceRegistry->>Platform: Return integrationId

    par Execute Command
        Platform->>Integrations: Forward Command (deviceId, command)
        Integrations->>Device: Transmit Command
    and Log Command Event
        Platform->>EventBus: Publish Command Initiated Event
    end

    Device->>Integrations: Report New State
    Integrations->>DeviceRegistry: Update Device State

    par Notify Updates
        DeviceRegistry->>EventBus: Publish State Changed Event
        EventBus->>Platform: Forward State Event
        Platform->>Api: Return Command Execution Result
    and Notify Subscribers
        EventBus->>Subscribers: Broadcast State Change
        EventBus->>Subscribers: Broadcast Command Complete
    end
```


## Integration Initialization Sequence

```mermaid
sequenceDiagram
    participant Platform
    participant IntegrationsConfig as "Integrations Config"
    participant Integrations

    Platform->>IntegrationsConfig: Load Integration Configurations
    IntegrationsConfig-->>Platform: Return Integration Settings
    Platform->>Integrations: Initialize Integrations with Config
```

## Device Discovery Sequence

```mermaid
sequenceDiagram
    participant Platform
    participant DeviceRegistry as "Device Registry"
    participant EventBus as "Event Bus"
    participant Integrations
    participant Device

    Platform->>Integrations: Trigger Discovery
    Integrations->>Device: Discover Devices<br/>(zeroconf, mDNS, MQTT, etc.)
    Device->>Integrations: Report Device Presence/State

    par Register Device
        Integrations->>DeviceRegistry: Register New Device<br/>(deviceId, integrationId, name, type, state)
        DeviceRegistry->>Platform: Return Registration Result
    and Notify Discovery
        Integrations->>EventBus: Publish Device Discovered Event
        EventBus->>Subscribers: Broadcast New Device Event
    end

    Platform->>DeviceRegistry: Query for Newly Discovered Devices
    DeviceRegistry->>Platform: Return Device List

    Platform->>EventBus: Publish Discovery Complete Event
    EventBus->>Subscribers: Broadcast Discovery Complete
```

## Camera Live Streaming Sequence

```mermaid
sequenceDiagram
    participant MobileApp as "Mobile App"
    participant Platform
    participant DeviceRegistry as "Device Registry"
    participant EventBus as "Event Bus"
    participant CamIntegration as "Camera Integration"
    participant CamDevice as "Camera Device"

    MobileApp->>Platform: Request Camera Stream (deviceId)
    Platform->>DeviceRegistry: Retrieve Camera Info (deviceId)
    DeviceRegistry->>Platform: Return Camera Details

    par Setup Stream
        Platform->>CamIntegration: Initiate Stream Setup
        CamIntegration->>CamDevice: Start Streaming
    and Log Stream Start
        Platform->>EventBus: Publish Stream Requested Event
    end

    CamDevice->>CamIntegration: Provide Stream URL/Token
    CamIntegration->>Platform: Send Stream Connection Details

    Platform->>EventBus: Publish Stream Started Event
    Platform->>MobileApp: Return Stream Connection Info

    loop While Streaming
        CamDevice->>MobileApp: Transmit Video Frames<br/>(RTSP/HLS)
        MobileApp->>Platform: Send Keep-Alive/Health Check
        Platform->>EventBus: Publish Stream Health Event
    end

    MobileApp->>Platform: End Stream Request

    par Cleanup
        Platform->>CamIntegration: Terminate Stream
        CamIntegration->>CamDevice: Stop Streaming
    and Notify
        Platform->>EventBus: Publish Stream Ended Event
        EventBus->>Subscribers: Broadcast Stream Status
    end
```

## Store Sensor Time Series Data

```mermaid
sequenceDiagram
    participant Device
    participant Integrations
    participant Platform
    participant TimeSeriesDB as "Time Series DB"
    participant DeviceRegistry as "Device Registry"

    Device->>Integrations: Report Sensor Data<br/>(temperature, humidity, etc.)
    Integrations->>Platform: Forward Sensor Data

    par
      Platform->>DeviceRegistry: Update Current Device State
    and
      Platform->>TimeSeriesDB: Store Time Series Data Entry
    end

    loop Data Retention Process
        TimeSeriesDB->>TimeSeriesDB: Aggregate Old Data<br/>(hourly, daily)
        TimeSeriesDB->>TimeSeriesDB: Purge Raw Data<br/>(per retention policy)
    end

    Note over Platform,TimeSeriesDB: Data includes:<br/>- Timestamp<br/>- Device ID<br/>- Sensor Type<br/>- Value<br/>- Unit
```

## Store Device State History

```mermaid
sequenceDiagram
    participant Device
    participant Integrations
    participant Platform
    participant DeviceRegistry as "Device Registry"
    participant StateHistoryDB as "State History DB"

    Device->>Integrations: Emit State Change Event
    Integrations->>Platform: Forward State Change

    par
      Platform->>DeviceRegistry: Update Current Device State
    and
      Platform->>StateHistoryDB: Record State Change
    end

    Note over Platform,StateHistoryDB: Recorded Data:<br/>- Timestamp<br/>- Device ID<br/>- Previous State<br/>- New State<br/>- Trigger (User/Automation)

    loop Cleanup Routine
        StateHistoryDB->>StateHistoryDB: Archive/Remove Old Records<br/>(per retention policy)
    end

    opt For State Recovery
        Platform->>StateHistoryDB: Query Historical State (Time T)
        StateHistoryDB->>Platform: Return State Snapshot
        Platform->>DeviceRegistry: Cross-verify with Current State
    end
```

## Store Device Events

```mermaid
sequenceDiagram
    participant Device
    participant Integrations
    participant Platform
    participant EventBus as "Event Bus"
    participant EventStore as "Event Store"
    participant Subscribers

    Device->>Integrations: Generate Event<br/>(motion, error, etc.)
    Integrations->>Platform: Forward Event

    Platform->>EventBus: Publish Event

    par
      EventBus->>EventStore: Persist Event
    and
      EventBus->>Subscribers: Broadcast Event
    end

    Note over Platform,EventStore: Event Details:<br/>- Timestamp<br/>- Device ID<br/>- Event Type<br/>- Data<br/>- Severity<br/>- Context

    loop Event Processing
        EventStore->>EventStore: Index/Optimize Records
        EventStore->>EventStore: Cleanup Old Events<br/>(by type & retention policy)
    end

    opt Event Query
        Platform->>EventStore: Query Events<br/>(filter by device, type, time)
        EventStore->>Platform: Return Matching Events
    end
```

## Device Shadow State and Simulation

```mermaid
sequenceDiagram
    participant Client
    participant Platform
    participant ShadowService as "Shadow Service"
    participant DeviceRegistry as "Device Registry"
    participant SimDevice as "Simulated Device"

    Note over Platform,ShadowService: Shadow Service tracks desired vs. reported states

    alt Real Device Offline
        Client->>Platform: Send Command (deviceId, command)
        Platform->>ShadowService: Update Desired State for Device
        ShadowService-->>Platform: Notify Device Offline
        Platform->>Client: Acknowledge (Command Queued)

        loop Waiting for Device Reconnection
            ShadowService->>ShadowService: Queue Pending Commands
        end

        Note over ShadowService: Upon device reconnection:
        ShadowService->>DeviceRegistry: Sync Pending Commands to Device
    else Simulated Device
        Client->>Platform: Send Command (deviceId, command)
        Platform->>ShadowService: Update Desired State
        ShadowService->>SimDevice: Execute Simulation
        SimDevice->>ShadowService: Report Simulated State
        ShadowService->>Platform: Forward Updated State
        Platform->>Client: Acknowledge (Command Executed)

        loop Simulation Loop
            SimDevice->>SimDevice: Update Internal Simulation State<br/>(per simulation rules)
            SimDevice->>ShadowService: Report Updated Simulated State
        end
    end

    Note over Platform,ShadowService: Shadow Record:<br/>- Device ID<br/>- Desired State<br/>- Reported State<br/>- Last Updated Timestamp<br/>- Connection Status<br/>- Simulation Mode Flag
```
