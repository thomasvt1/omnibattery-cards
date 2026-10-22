import { BaseCard } from './base-card';
import type { CardConfig, HomeAssistant } from './types';

const cache = new WeakMap<object, Map<string, {until: number; value: Promise<unknown>}>>();
/** Share read-only requests across cards; errors are retried on the next refresh. */
export function readCached<T>(hass: HomeAssistant, key: string, load: () => Promise<T>): Promise<T> {
  const connection = hass.connection ?? hass.callWS ?? hass;
  let entries = cache.get(connection);
  if (!entries) { entries = new Map(); cache.set(connection, entries); }
  const old = entries.get(key);
  if (old && old.until > Date.now()) return old.value as Promise<T>;
  const value = load();
  entries.set(key, {until: Date.now() + 30_000, value});
  return value;
}

/** Poll only while attached; discard responses after config/connection changes. */
export abstract class ReadingsCard<T> extends BaseCard {
  protected readings?: T;
  protected readingsError = '';
  private poll?: ReturnType<typeof setInterval>;
  private request = 0;
  private key?: object;
  get hass() { return super.hass; }
  set hass(value: HomeAssistant) {
    super.hass = value;
    const key = value.connection ?? value.callWS ?? value;
    if (key !== this.key) { this.key = key; this.readings = undefined; void this.refreshReadings(); }
  }
  setConfig(config: CardConfig) {
    super.setConfig(config); this.readings = undefined; void this.refreshReadings();
  }
  connectedCallback() {
    super.connectedCallback();
    this.poll = setInterval(() => { void this.refreshReadings(); }, 60_000);
    void this.refreshReadings();
  }
  disconnectedCallback() { super.disconnectedCallback(); clearInterval(this.poll); this.request++; }
  protected abstract loadReadings(): Promise<T>;
  private async refreshReadings() {
    const request = ++this.request;
    if (!this.isConnected || !this.config) return;
    try {
      const data = await this.loadReadings();
      if (request !== this.request) return;
      this.readings = data; this.readingsError = '';
    } catch (error) {
      if (request !== this.request) return;
      this.readings = undefined;
      this.readingsError = error instanceof Error ? error.message : 'Could not read stored data. Retrying automatically.';
    }
    this.invalidate();
  }
}
