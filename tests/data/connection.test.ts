import { describe, expect, it, vi, type Mock } from 'vitest';
import { loadRegistry, watchRegistry } from '../../src/connection';
import type { HomeAssistant, RegistryData } from '../../src/types';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function connection() {
  const subscriptions: { callback: (event: unknown) => void; type: string; pending: ReturnType<typeof deferred<() => void>>; stop: Mock<() => void> }[] = [];
  const requests: { type: string; pending: ReturnType<typeof deferred<unknown>> }[] = [];
  const hass: HomeAssistant = {
    states: {}, connection: { subscribeEvents: (callback, type) => {
      const pending = deferred<() => void>(), stop = vi.fn();
      subscriptions.push({ callback, type, pending, stop });
      return pending.promise;
    } },
    callWS: <T>(message: Record<string, unknown>) => {
      const pending = deferred<unknown>();
      requests.push({ type: String(message.type), pending });
      return pending.promise as Promise<T>;
    },
  };
  return { hass, subscriptions, requests };
}

describe('shared registry lifecycle', () => {
  it('shares event subscriptions and removes them only when the final card disconnects', async () => {
    const { hass, subscriptions } = connection();
    const first = vi.fn(), second = vi.fn();
    const stopFirst = watchRegistry(hass, first), stopSecond = watchRegistry(hass, second);
    expect(subscriptions).toHaveLength(2);
    subscriptions.forEach(item => item.pending.resolve(item.stop));
    subscriptions[0].callback({});
    expect(first).toHaveBeenCalledOnce(); expect(second).toHaveBeenCalledOnce();
    stopFirst();
    expect(subscriptions.every(item => item.stop.mock.calls.length === 0)).toBe(true);
    stopSecond();
    await vi.waitFor(() => expect(subscriptions.every(item => item.stop.mock.calls.length === 1)).toBe(true));
    subscriptions[0].callback({});
    expect(second).toHaveBeenCalledOnce();
  });

  it('restarts watchers after disconnect and reconnect during pending subscription setup', async () => {
    const { hass, subscriptions } = connection();
    const first = vi.fn(), replacement = vi.fn();
    const stopFirst = watchRegistry(hass, first);
    stopFirst();
    const stopReplacement = watchRegistry(hass, replacement);
    expect(subscriptions).toHaveLength(2);
    subscriptions.slice(0, 2).forEach(item => item.pending.resolve(item.stop));
    await vi.waitFor(() => expect(subscriptions).toHaveLength(4));
    expect(subscriptions.slice(0, 2).every(item => item.stop.mock.calls.length === 1)).toBe(true);
    subscriptions.slice(2).forEach(item => item.pending.resolve(item.stop));
    subscriptions[0].callback({}); // late event from a discarded generation
    expect(replacement).not.toHaveBeenCalled();
    subscriptions[2].callback({});
    expect(replacement).toHaveBeenCalledOnce();
    expect(first).not.toHaveBeenCalled();
    stopReplacement();
    await vi.waitFor(() => expect(subscriptions.slice(2).every(item => item.stop.mock.calls.length === 1)).toBe(true));
  });

  it('waits for a late subscription even when its companion has already failed', async () => {
    const { hass, subscriptions } = connection();
    const stopFirst = watchRegistry(hass, vi.fn());
    stopFirst();
    const replacement = vi.fn(), stopReplacement = watchRegistry(hass, replacement);
    subscriptions[0].pending.reject(new Error('Disconnected'));
    subscriptions[1].pending.resolve(subscriptions[1].stop);
    await vi.waitFor(() => expect(subscriptions).toHaveLength(4));
    expect(subscriptions[1].stop).toHaveBeenCalledOnce();
    subscriptions.slice(2).forEach(item => item.pending.resolve(item.stop));
    subscriptions[2].callback({});
    expect(replacement).toHaveBeenCalledOnce();
    stopReplacement();
    await vi.waitFor(() => expect(subscriptions.slice(2).every(item => item.stop.mock.calls.length === 1)).toBe(true));
  });

  it('shares pending and completed registry reads', async () => {
    const { hass, requests } = connection();
    const first = loadRegistry(hass), second = loadRegistry(hass);
    expect(first).toBe(second);
    expect(requests.map(request => request.type)).toEqual(['config/entity_registry/list', 'config/device_registry/list']);
    const data: RegistryData = { entities: [{ entity_id: 'sensor.synthetic' }], devices: [{ id: 'battery' }] };
    requests[0].pending.resolve(data.entities); requests[1].pending.resolve(data.devices);
    expect(await first).toEqual(data);
    expect(await loadRegistry(hass)).toEqual(data);
    expect(requests).toHaveLength(2);
  });

  it('reloads after an event during a pending read, even if the card is already loading', async () => {
    const { hass, requests, subscriptions } = connection();
    const listener = vi.fn(); // The card's loading guard does not start another read.
    const stop = watchRegistry(hass, listener);
    subscriptions.forEach(item => item.pending.resolve(item.stop));
    const pending = loadRegistry(hass);
    subscriptions[0].callback({});
    expect(listener).toHaveBeenCalledOnce();
    requests[0].pending.resolve([{ entity_id: 'sensor.old_name' }]); requests[1].pending.resolve([]);
    await vi.waitFor(() => expect(requests).toHaveLength(4));
    const current: RegistryData = { entities: [{ entity_id: 'sensor.new_name' }], devices: [{ id: 'new-device' }] };
    requests[2].pending.resolve(current.entities); requests[3].pending.resolve(current.devices);
    expect(await pending).toEqual(current);
    expect(await loadRegistry(hass)).toEqual(current);
    expect(requests).toHaveLength(4);
    stop();
  });

  it('does not evict the fresh cache when an invalidated older request fails', async () => {
    const { hass, requests, subscriptions } = connection();
    const stop = watchRegistry(hass, vi.fn());
    subscriptions.forEach(item => item.pending.resolve(item.stop));
    const old = loadRegistry(hass);
    subscriptions[1].callback({});
    const fresh = loadRegistry(hass);
    expect(requests).toHaveLength(4);
    requests[0].pending.reject(new Error('Old request failed')); requests[1].pending.resolve([]);
    const current: RegistryData = { entities: [{ entity_id: 'sensor.current' }], devices: [] };
    requests[2].pending.resolve(current.entities); requests[3].pending.resolve(current.devices);
    expect(await fresh).toEqual(current);
    expect(await old).toEqual(current);
    expect(loadRegistry(hass)).toBe(fresh);
    expect(requests).toHaveLength(4);
    stop();
  });
});
