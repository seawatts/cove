# Home Assistant Platform Architecture

Below is a Mermaid diagram that outlines the architecture of the entire Home Assistant platform:

```mermaid
flowchart TD
  %% Home Assistant OS and Container Setup
  subgraph "Home Assistant OS Layer"
    A[Minimal Linux OS]
    B[Custom Kernel & Bootloader]
  end

  subgraph "Container Runtime Layer"
    C[Container Runtime - Docker]
  end

  subgraph "Supervisor Layer"
    D[Supervisor - Hass.io]
  end

  subgraph "Core Applications"
    E[Home Assistant Core]
    F[Add-ons]
  end

  A --> B
  B --> C
  C --> D
  D --> E
  D --> F

  %% Device Discovery & Integration Flow
  subgraph "Device Integration Flow" [Device Discovery & Registration]
    G[Discovery Protocols<br/>mDNS, SSDP, Bluetooth]
    H[Discovery Service]
    I[Event Bus & Metadata Collection]
    J[Integration Matching & Config Flow Trigger]
    K[User Config Flow<br/>Auto & Manual]
    L[Device Registration<br/>Device & Entity Registry]
    M[Entity Association]
  end

  %% Flow from Discovery to Registration
  G --> H
  H --> I
  I --> J
  J --> K
  K --> L
  L --> M

  %% Interaction with Home Assistant Core
  E --- L
```

# Detailed Integration Matching & Config Flow Trigger

Below is the Mermaid diagram that goes deeper into how Home Assistant handles integration matching and configuration flow triggering:

```mermaid
flowchart TD
  subgraph "Integration Matching & Config Flow Trigger"
    A[Receive Discovery Metadata<br/>device type, manufacturer, model, unique ID]
    B[Extract Key Attributes<br/>e.g., MAC address, model name]
    C[Check Manufacturer & Model<br/>for compatibility]
    D[Lookup Integration Manifest<br/>supported devices, version requirements]
    E[Determine Device Version & Capabilities]
    F[Check for Existing Configuration<br/>prevent duplicates]
    G{Is Device New?}
    H[Trigger Integration's Config Flow Handler]
    I[Auto-Populate Configuration Fields<br/>using discovery metadata]
    J[Prompt User for Additional Input<br/>e.g., API key, confirmation]
    K[Create/Update Configuration Entry<br/>register device in registry]
    L[Abort/Skip if Already Configured]

    A --> B
    B --> C
    C --> D
    D --> E
    E --> F
    F --> G
    G -- Yes --> H
    G -- No --> L
    H --> I
    I --> J
    J --> K
  end
```