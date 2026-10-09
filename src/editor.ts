import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import { loadRegistry, watchRegistry } from './connection';
import type { CardConfig, HomeAssistant, RegistryData, RegistryEntity } from './types';

type Override = readonly [key: string, label: string, help?: string];

const sources: Override[] = [
  ['grid', 'Grid power', 'Positive means importing. Enable the sign option below for an export-positive source.'],
  ['solar', 'Solar power', 'Use the complete solar source; individual MPPT values are not added.'],
  ['home', 'Home consumption'],
  ['timeline', 'Daily operation timeline', 'The Omnibattery timeline sensor with schema 1 attributes.'],
];
const systemMetrics: Override[] = [
  ['soc', 'Charge level'], ['stored', 'Stored energy'], ['capacity', 'Battery capacity'],
  ['cellPower', 'Battery-cell power'], ['acPower', 'Battery AC power'],
  ['chargePower', 'AC charging power'], ['dischargePower', 'AC discharging power'],
  ['status', 'Integration status'], ['dailySolar', 'Solar today'], ['dailyHome', 'Home today'],
  ['dailyGridImport', 'Grid import today'], ['dailyGridExport', 'Grid export today'],
  ['dailyCharge', 'Charged today'], ['dailyDischarge', 'Discharged today'],
];
const batteryMetrics: Override[] = [
  ['batterySoc', 'Charge level'], ['batteryStored', 'Stored energy'],
  ['batteryCapacity', 'Battery capacity'], ['batteryCellPower', 'Battery-cell power'],
  ['batteryAcPower', 'Battery AC power'], ['batteryTemperature', 'Temperature'],
  ['batteryDailyCharge', 'Charged today'], ['batteryDailyDischarge', 'Discharged today'],
];
const systemBatteryMetrics: Override[] = [
  ['soc', 'Charge level'], ['stored', 'Stored energy'], ['capacity', 'Battery capacity'],
];

const integrationEntity = (entity: RegistryEntity) =>
  entity.platform === 'omnibattery' || entity.platform === 'marstek_venus';

/** Uses read-only registry requests and emits Lovelace configuration changes only. */
export class OmnibatteryCardEditor extends LitElement {
  static properties = {
    hass: { attribute: false }, config: { attribute: false },
    registry: { state: true }, registryError: { state: true },
  };

  declare hass?: HomeAssistant;
  declare config?: CardConfig;
  private registry: RegistryData = { entities: [], devices: [] };
  private registryError = '';
  private registryConnection?: object;
  private registryStop?: () => void;
  private registryLoaded = false;
  private registryPending = false;
  private generation = 0;

  setConfig(config: CardConfig) {
    this.config = { ...config, entities: config.entities ? { ...config.entities } : undefined };
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.generation += 1;
    this.registryPending = false;
    this.registryLoaded = false;
    this.registryStop?.();
    this.registryStop = undefined;
  }

  protected updated(changed: PropertyValues) {
    if (changed.has('hass') && this.hass) {
      const key = this.hass.connection || this.hass.callWS || this.hass;
      if (this.registryConnection !== key) {
        this.generation += 1;
        this.registryPending = false;
        this.registryLoaded = false;
        this.registryStop?.();
        this.registryStop = undefined;
        this.registryConnection = key;
      }
      if (!this.registryPending && !this.registryLoaded) void this.refreshRegistry();
    }
  }

  connectedCallback() {
    super.connectedCallback();
    if (this.hass && !this.registryLoaded && !this.registryPending) void this.refreshRegistry();
  }

  private async refreshRegistry() {
    const hass = this.hass;
    if (!hass || !this.isConnected) return;
    const generation = ++this.generation;
    this.registryPending = true;
    this.registryConnection = hass.connection || hass.callWS || hass;
    if (!this.registryStop) this.registryStop = watchRegistry(hass, () => { void this.refreshRegistry(); });
    try {
      const registry = await loadRegistry(hass);
      if (generation !== this.generation) return;
      this.registry = registry;
      this.registryError = '';
      this.registryLoaded = true;
    } catch {
      if (generation !== this.generation) return;
      this.registryError = 'Discovery is unavailable. You can still enter entity IDs below or use the YAML editor.';
      this.registryLoaded = true;
    } finally {
      if (generation === this.generation) this.registryPending = false;
    }
  }

  private updateConfig(key: keyof CardConfig, value: string | boolean | undefined) {
    if (!this.config) return;
    const config = { ...this.config };
    if (key === 'integration_id' && value !== config.integration_id) delete config.battery;
    if (value === '' || value === undefined) delete config[key];
    else Object.assign(config, { [key]: value });
    this.emitConfig(config);
  }

  private updateEntity(key: string, value: string) {
    if (!this.config) return;
    const entities = { ...this.config.entities };
    if (value.trim()) entities[key] = value.trim();
    else delete entities[key];
    const config = { ...this.config };
    if (Object.keys(entities).length) config.entities = entities;
    else delete config.entities;
    this.emitConfig(config);
  }

  private emitConfig(config: CardConfig) {
    this.config = config;
    this.dispatchEvent(new CustomEvent('config-changed', {
      detail: { config }, bubbles: true, composed: true,
    }));
  }

  private inputValue(event: Event) { return (event.target as HTMLInputElement).value; }

  private entityField(key: string, label: string, help?: string, topLevel = false) {
    const value = topLevel ? this.config?.[key as 'import_price_entity' | 'export_price_entity'] : this.config?.entities?.[key];
    return html`
      <label class="field" for=${key}>
        <span id=${`${key}-label`}>${label}</span>
        <input id=${key} type="text" list="entities" .value=${value ?? ''}
          placeholder=${topLevel ? 'Optional entity ID' : 'Automatic'} spellcheck="false" autocomplete="off"
          aria-labelledby=${`${key}-label`}
          aria-describedby=${help ? `${key}-help` : nothing}
          @change=${(event: Event) => topLevel
            ? this.updateConfig(key as keyof CardConfig, this.inputValue(event).trim())
            : this.updateEntity(key, this.inputValue(event))} />
        ${help ? html`<small id=${`${key}-help`}>${help}</small>` : nothing}
      </label>`;
  }

  render() {
    const config = this.config;
    if (!config) return nothing;
    const isBattery = config.type === 'custom:omnibattery-battery-card';
    const isSystemBattery = config.type === 'custom:omnibattery-system-battery-card';
    const isPlan = config.type === 'custom:omnibattery-plan-card';
    const entities = this.registry.entities.filter(integrationEntity);
    const integrationIds = [...new Set(entities.map(entity => entity.config_entry_id).filter((id): id is string => !!id))];
    const scoped = entities.filter(entity => !config.integration_id || entity.config_entry_id === config.integration_id);
    const deviceIds = new Set(scoped.filter(entity => entity.device_id &&
      !entity.translation_key?.startsWith('system_') && !entity.unique_id?.startsWith('marstek_venus_system_') &&
      !entity.unique_id?.startsWith('omnibattery_system_')).map(entity => entity.device_id));
    const devices = this.registry.devices.filter(device => deviceIds.has(device.id));
    const stateIds = Object.keys(this.hass?.states ?? {}).filter(id => id.startsWith('sensor.') || id.startsWith('binary_sensor.')).sort();

    return html`
      <div class="editor">
        <p class="intro">Select your Omnibattery installation. Leave entity fields empty to discover them automatically.</p>
        ${this.registryError ? html`<p class="notice" role="status">${this.registryError}</p>` : nothing}
        <label class="field" for="title"><span>Title</span>
          <input id="title" .value=${config.title ?? ''} placeholder="Default card title"
            @change=${(event: Event) => this.updateConfig('title', this.inputValue(event))} />
        </label>
        <label class="field" for="integration"><span id="integration-label">Omnibattery installation</span>
          <select id="integration" aria-labelledby="integration-label"
            @change=${(event: Event) => this.updateConfig('integration_id', this.inputValue(event))}>
            <option value="" .selected=${!config.integration_id}>Automatic</option>
            ${integrationIds.map(id => {
              const device = this.registry.devices.find(item => item.config_entries?.includes(id));
              return html`<option value=${id} .selected=${config.integration_id === id}>${device?.name_by_user || device?.name || 'Omnibattery'} · ${id}</option>`;
            })}
            ${config.integration_id && !integrationIds.includes(config.integration_id)
              ? html`<option value=${config.integration_id} .selected=${true}>${config.integration_id} (unavailable)</option>` : nothing}
          </select>
        </label>
        ${isSystemBattery ? html`
          <label class="field" for="layout"><span id="layout-label">Layout</span>
            <select id="layout" aria-labelledby="layout-label"
              @change=${(event: Event) => this.updateConfig('layout', this.inputValue(event))}>
              <option value="columns" .selected=${(config.layout ?? 'columns') === 'columns'}>C — Three columns (default)</option>
              <option value="stacked" .selected=${config.layout === 'stacked'}>A — Familiar stack</option>
              <option value="compact" .selected=${config.layout === 'compact'}>B — Compact rows</option>
            </select>
          </label>` : nothing}
        ${isBattery ? html`
          <label class="field" for="battery"><span id="battery-label">Battery device</span>
            <select id="battery" aria-labelledby="battery-label" aria-describedby="battery-help"
              @change=${(event: Event) => this.updateConfig('battery', this.inputValue(event))}>
              <option value="" .selected=${!config.battery}>Automatic</option>
              ${devices.map(device => html`<option value=${device.id} .selected=${config.battery === device.id}>${device.name_by_user || device.name || device.model || device.id}</option>`)}
              ${config.battery && !devices.some(device => device.id === config.battery)
                ? html`<option value=${config.battery} .selected=${true}>${config.battery} (unavailable)</option>` : nothing}
            </select>
            <small id="battery-help">Add one Battery card for each device you want to display.</small>
          </label>` : nothing}
        ${isPlan ? html`
          ${this.entityField('import_price_entity', 'Import price entity', 'Optional Nord Pool sensor with timestamped raw_today / raw_tomorrow attributes.', true)}
          ${this.entityField('export_price_entity', 'Export price entity', 'Optional explicit export tariff source in the same timestamped format.', true)}
          <label class="toggle"><input type="checkbox" .checked=${config.show_extension === true}
            @change=${(event: Event) => this.updateConfig('show_extension', (event.target as HTMLInputElement).checked)} />
            <span>Show next-day timeline when available</span>
          </label>` : nothing}
        <details>
          <summary>Entity overrides</summary>
          <p class="help">Optional. Use these when discovery cannot identify a source, or to select another sensor. Empty fields restore automatic discovery.</p>
          ${(isBattery ? batteryMetrics : isSystemBattery ? systemBatteryMetrics : sources).map(([key, label, help]) => this.entityField(key, label, help))}
          ${!isBattery && !isSystemBattery ? html`<label class="toggle"><input type="checkbox" .checked=${config.grid_inverted === true}
            @change=${(event: Event) => this.updateConfig('grid_inverted', (event.target as HTMLInputElement).checked)} />
            <span>Grid source is positive when exporting</span>
          </label>` : nothing}
          ${!isBattery && !isPlan && !isSystemBattery ? systemMetrics.map(([key, label, help]) => this.entityField(key, label, help)) : nothing}
          ${!isSystemBattery && (isBattery || !isPlan) ? html`<p class="help">Explicit battery-cell and AC power overrides must be positive when charging and negative when discharging. AC and cell power are kept separate.</p>` : nothing}
        </details>
        <datalist id="entities">${stateIds.map(id => html`<option value=${id}>${String(this.hass?.states[id].attributes.friendly_name ?? id)}</option>`)}</datalist>
      </div>`;
  }

  static styles = css`
    :host { display: block; color: var(--primary-text-color, #202523); font-family: var(--paper-font-body1_-_font-family, inherit); }
    .editor { display: grid; gap: 16px; padding: 4px 0 12px; }
    p { margin: 0; line-height: 1.5; }
    .intro, .help, small { color: var(--secondary-text-color, #68716b); font-size: 13px; }
    .field { display: grid; gap: 7px; font-size: 14px; min-width: 0; }
    .field > span { font-weight: 500; }
    input:not([type='checkbox']), select {
      box-sizing: border-box; width: 100%; min-height: 44px; min-width: 0;
      border: 1px solid var(--divider-color, #d4dcd6); border-radius: 8px;
      padding: 10px 12px; color: var(--primary-text-color, #202523);
      background: var(--card-background-color, #fff); font: inherit;
    }
    input:focus-visible, select:focus-visible, summary:focus-visible {
      outline: 2px solid var(--primary-color, #327965); outline-offset: 2px;
    }
    .toggle { display: flex; align-items: center; gap: 10px; min-height: 44px; font-size: 14px; cursor: pointer; }
    input[type='checkbox'] { width: 20px; height: 20px; margin: 0; accent-color: var(--primary-color, #327965); flex-shrink: 0; }
    small { line-height: 1.4; }
    .notice { padding: 12px; border: 1px solid var(--divider-color, #d4dcd6); border-radius: 8px; font-size: 13px; }
    details { border-top: 1px solid var(--divider-color, #d4dcd6); padding-top: 8px; }
    details > .field, details > .help, details > .toggle { margin-top: 16px; }
    summary { min-height: 44px; display: list-item; align-content: center; cursor: pointer; font-weight: 500; font-size: 14px; }
  `;
}
