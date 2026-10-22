import { html } from 'lit';

export const companionInstallUrl = 'https://my.home-assistant.io/redirect/hacs_repository/?owner=thomasvt1&repository=omnibattery-cards&category=integration';
export const companionSetupUrl = 'https://my.home-assistant.io/redirect/config_flow_start/?domain=omnibattery_cards';

export function companionSetup(installed = false) {
  return html`<div class="footnote companion-setup">${installed
    ? html`<a href="/config/integrations/integration/omnibattery_cards">Configure recordings</a>`
    : html`<a href=${companionInstallUrl} target="_blank" rel="noopener noreferrer">Install Omnibattery Cards integration</a>
        <span> · </span><a href=${companionSetupUrl} target="_blank" rel="noopener noreferrer">Set up after installation</a>`}
  </div>`;
}
