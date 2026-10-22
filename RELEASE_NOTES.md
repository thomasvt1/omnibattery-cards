## Fix integration dashboard visibility

Omnibattery Cards was incorrectly classified as a helper in v0.6.0. It could be loaded and show its device while remaining absent from Settings → Devices & services → Integrations.

This release classifies it as a service. Update in HACS and restart Home Assistant so its manifest is reloaded, then refresh the browser. **Do not remove or recreate the integration.** Existing devices, entity IDs, settings, and recordings are preserved.

The frontend console banner now reads its version from the integration manifest during the build.

Verified with a failing-then-passing test through Home Assistant’s actual WebSocket integration-type filter. Users upgrading from the older standalone Dashboard releases should follow the existing README migration instructions.
