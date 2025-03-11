use crate::proto::api::{
    AlarmControlPanelStateResponse, BinarySensorStateResponse, ClimateStateResponse,
    CoverStateResponse, DateStateResponse, DateTimeStateResponse, FanStateResponse,
    LightStateResponse, ListEntitiesAlarmControlPanelResponse, ListEntitiesBinarySensorResponse,
    ListEntitiesButtonResponse, ListEntitiesCameraResponse, ListEntitiesClimateResponse,
    ListEntitiesCoverResponse, ListEntitiesDateResponse, ListEntitiesDateTimeResponse,
    ListEntitiesEventResponse, ListEntitiesFanResponse, ListEntitiesLightResponse,
    ListEntitiesLockResponse, ListEntitiesMediaPlayerResponse, ListEntitiesNumberResponse,
    ListEntitiesRequest, ListEntitiesSelectResponse, ListEntitiesSensorResponse,
    ListEntitiesSirenResponse, ListEntitiesSwitchResponse, ListEntitiesTextResponse,
    ListEntitiesTextSensorResponse, ListEntitiesTimeResponse, ListEntitiesUpdateResponse,
    ListEntitiesValveResponse, LockStateResponse, MediaPlayerStateResponse, NumberStateResponse,
    SelectStateResponse, SensorStateResponse, SirenStateResponse, SwitchStateResponse,
    TextSensorStateResponse, TextStateResponse, TimeStateResponse, UpdateStateResponse,
    ValveStateResponse,
};

/// Enum representing all possible state responses
#[derive(Debug, Clone)]
pub enum StateResponse {
    AlarmControlPanel(AlarmControlPanelStateResponse),
    BinarySensor(BinarySensorStateResponse),
    Climate(ClimateStateResponse),
    Cover(CoverStateResponse),
    Date(DateStateResponse),
    DateTime(DateTimeStateResponse),
    Fan(FanStateResponse),
    Light(LightStateResponse),
    Lock(LockStateResponse),
    MediaPlayer(MediaPlayerStateResponse),
    Number(NumberStateResponse),
    Select(SelectStateResponse),
    Sensor(SensorStateResponse),
    Siren(SirenStateResponse),
    Switch(SwitchStateResponse),
    Text(TextStateResponse),
    TextSensor(TextSensorStateResponse),
    Time(TimeStateResponse),
    Update(UpdateStateResponse),
    Valve(ValveStateResponse),
}

/// Enum representing all entity types that can be listed from an ESPHome device
#[derive(Debug, Clone)]
pub enum Entity {
    Entity(ListEntitiesRequest),
    Climate(ListEntitiesClimateResponse),
    Camera(ListEntitiesCameraResponse),
    Number(ListEntitiesNumberResponse),
    Select(ListEntitiesSelectResponse),
    Siren(ListEntitiesSirenResponse),
    Lock(ListEntitiesLockResponse),
    Button(ListEntitiesButtonResponse),
    MediaPlayer(ListEntitiesMediaPlayerResponse),
    Event(ListEntitiesEventResponse),
    BinarySensor(ListEntitiesBinarySensorResponse),
    Cover(ListEntitiesCoverResponse),
    Fan(ListEntitiesFanResponse),
    Light(ListEntitiesLightResponse),
    Sensor(ListEntitiesSensorResponse),
    Switch(ListEntitiesSwitchResponse),
    TextSensor(ListEntitiesTextSensorResponse),
    AlarmControlPanel(ListEntitiesAlarmControlPanelResponse),
    Date(ListEntitiesDateResponse),
    DateTime(ListEntitiesDateTimeResponse),
    Text(ListEntitiesTextResponse),
    Time(ListEntitiesTimeResponse),
    Valve(ListEntitiesValveResponse),
    Update(ListEntitiesUpdateResponse),
}

/// Configuration for ESPHome connection
#[derive(Debug, Clone)]
pub struct ESPHomeConfig {
    pub address: String,
    pub password: Option<String>,
    pub timeout: std::time::Duration,
}
