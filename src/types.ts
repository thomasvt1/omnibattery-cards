export type Tone = 'neutral' | 'good' | 'warning' | 'error';
export interface HassEntity {
  entity_id: string; state: string; attributes: Record<string, unknown>;
  last_updated?: string; last_changed?: string;
}
export interface RegistryEntity {
  entity_id: string; platform?: string; unique_id?: string; translation_key?: string;
  config_entry_id?: string; device_id?: string | null; disabled_by?: string | null;
  hidden_by?: string | null; name?: string | null; original_name?: string | null;
}
export interface RegistryDevice {
  id: string; name?: string; name_by_user?: string | null; manufacturer?: string;
  model?: string; config_entries?: string[];
}
export interface RegistryData { entities: RegistryEntity[]; devices: RegistryDevice[]; }
export interface HomeAssistant {
  states: Record<string, HassEntity>;
  entities?: Record<string, RegistryEntity>;
  devices?: Record<string, RegistryDevice>;
  panels?: Record<string, { config?: Record<string, unknown> }>;
  locale?: { language?: string; number_format?: string; time_format?: string };
  language?: string;
  config?: { time_zone?: string; currency?: string };
  themes?: { darkMode?: boolean };
  callWS?: <T = unknown>(message: Record<string, unknown>) => Promise<T>;
  connection?: {
    subscribeEvents?: (callback: (event: unknown) => void, eventType: string) => Promise<() => void>;
  };
}
export type CardType = 'custom:omnibattery-plan-card' | 'custom:omnibattery-overview-card' | 'custom:omnibattery-battery-card' | 'custom:omnibattery-status-card';
export interface CardConfig {
  type: CardType; title?: string; integration_id?: string; battery?: string;
  entities?: Record<string, string>; grid_inverted?: boolean;
  import_price_entity?: string; export_price_entity?: string;
  show_extension?: boolean;
}
export interface Metric { value: number | null; entityId?: string; }
export interface BatteryModel {
  id: string; name: string; model?: string; available: boolean;
  soc: Metric; stored: Metric; capacity: Metric; cellPower: Metric; acPower: Metric;
  temperature: Metric; dailyCharge: Metric; dailyDischarge: Metric;
  health: { label: string; value: number; unit: string; entityId?: string }[];
}
export interface StatusRow { key: string; title: string; detail?: string; tone: Tone; icon: string; entityId?: string; }
export interface TimelineSlot {
  index: number; label: string; start?: string; end?: string; durationSeconds: number;
  repeated: boolean; skipped: boolean;
  solarActualKw: number | null; solarForecastKw: number | null;
  homeActualKw: number | null; homeForecastKw: number | null;
  socActual: number | null; socForecast: number | null;
  batteryActualKw: number | null; batteryForecastKw: number | null;
  actionActual: number | null; actionForecast: number | null;
  holdActual: boolean | null; holdForecast: boolean | null;
  actualCoverageSeconds: number | null;
}
export interface TimelineModel {
  available: boolean; error?: string; warnings: string[]; entityId?: string;
  localDate: string; timeZone: string; generatedAt?: string;
  currentIndex: number; currentProgress: number; stale: boolean; slots: TimelineSlot[];
}
export interface PriceSeries {
  entityId: string; unit: string; currency: string;
  points: { start: string; end: string; value: number }[];
}
export interface Snapshot {
  error?: string; warnings: string[]; integrationId?: string;
  grid: Metric; solar: Metric; home: Metric; cellPower: Metric; acPower: Metric;
  soc: Metric; stored: Metric; capacity: Metric;
  daily: { solar: Metric; home: Metric; gridImport: Metric; gridExport: Metric; charge: Metric; discharge: Metric };
  batteries: BatteryModel[]; status: StatusRow[]; timeline: TimelineModel;
  importPrices?: PriceSeries; exportPrices?: PriceSeries;
}
