import type { HomeAssistant, RegistryData } from './types';

interface SharedConnection {
  promise?: Promise<RegistryData>;
  listeners: Set<() => void>;
  unsubscribers: (() => void)[];
  subscribing?: Promise<void>;
  generation: number;
}
const connections = new WeakMap<object, SharedConnection>();
function shared(hass: HomeAssistant): SharedConnection {
  const key = hass.connection || hass.callWS || hass;
  let value = connections.get(key);
  if (!value) { value = { listeners: new Set(), unsubscribers: [], generation: 0 }; connections.set(key, value); }
  return value;
}
export function loadRegistry(hass: HomeAssistant): Promise<RegistryData> {
  const entry = shared(hass);
  if (!entry.promise) {
    const request: Promise<RegistryData> = (async () => {
      if (!hass.callWS) return { entities: Object.values(hass.entities || {}), devices: Object.values(hass.devices || {}) };
      const [entities, devices] = await Promise.all([
        hass.callWS<RegistryData['entities']>({ type: 'config/entity_registry/list' }),
        hass.callWS<RegistryData['devices']>({ type: 'config/device_registry/list' }),
      ]);
      return { entities, devices };
    })().then(data => {
      // A registry event can invalidate this request before it finishes. Its
      // callers must receive the replacement snapshot, not restore older data.
      if (entry.promise !== request && entry.listeners.size) return loadRegistry(hass);
      return data;
    }, (error: unknown) => {
      if (entry.promise === request) { entry.promise = undefined; throw error; }
      // An older failure must not evict a newer request from the shared cache.
      if (entry.listeners.size) return loadRegistry(hass);
      throw error;
    });
    entry.promise = request;
  }
  return entry.promise;
}
function subscribeRegistry(hass: HomeAssistant, entry: SharedConnection): void {
  if (entry.listeners.size && !entry.subscribing && !entry.unsubscribers.length && hass.connection?.subscribeEvents) {
    const subscribe = hass.connection.subscribeEvents.bind(hass.connection);
    const generation = entry.generation;
    // Wait for both promises even if one fails so a late subscription cannot
    // escape cleanup after another card has reconnected.
    entry.subscribing = Promise.allSettled(['entity_registry_updated', 'device_registry_updated'].map(async type => {
      const unsubscribe = await subscribe(() => {
        if (generation !== entry.generation || !entry.listeners.size) return;
        entry.promise = undefined;
        entry.listeners.forEach(callback => callback());
      }, type);
      if (generation !== entry.generation || !entry.listeners.size) unsubscribe();
      else entry.unsubscribers.push(unsubscribe);
    })).then(() => undefined).finally(() => {
      entry.subscribing = undefined;
      if (generation !== entry.generation && entry.listeners.size) subscribeRegistry(hass, entry);
    });
  }
}
export function watchRegistry(hass: HomeAssistant, listener: () => void): () => void {
  const entry = shared(hass);
  entry.listeners.add(listener);
  subscribeRegistry(hass, entry);
  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    entry.listeners.delete(listener);
    if (!entry.listeners.size) {
      entry.generation++;
      entry.unsubscribers.splice(0).forEach(unsubscribe => unsubscribe());
      entry.promise = undefined;
    }
  };
}
