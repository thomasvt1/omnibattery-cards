import { css, html, nothing } from 'lit';
import { BaseCard } from '../base-card';
import { icon } from '../ui';
import type { StatusRow } from '../types';

export class OmnibatteryStatusCard extends BaseCard {
  static getStubConfig() { return { type: 'custom:omnibattery-status-card' }; }

  getCardSize() {
    if (!this.config) return 6;
    const rows = this.snapshot.status;
    if (!rows.length) return 3;
    const height = rows.reduce((sum, row) => sum + 22 + Math.max(32,
      Math.ceil(row.title.length / 32) * 20 + (row.detail ? 2 + Math.ceil(row.detail.length / 38) * 18 : 0)), 76);
    return Math.ceil(height / 50);
  }

  static styles = [BaseCard.styles, css`
    .content { padding: 0; }
    .rows { list-style: none; margin: 0; padding: 0; }
    .row { margin: 0; padding: 0; }
    .row + .row { border-top: 1px solid var(--divider-color, #e6e8ec); }
    .status { display: flex; align-items: flex-start; gap: 12px; width: 100%; box-sizing: border-box; padding: 11px 0; color: var(--primary-text-color, #17202c); text-align: left; font: inherit; }
    button.status { border: 0; border-radius: 5px; background: transparent; cursor: pointer; }
    button.status:hover .title { text-decoration: underline; text-underline-offset: 3px; }
    button.status:focus-visible { outline: 2px solid var(--primary-color, #03a9f4); outline-offset: 3px; }
    .glyph { display: grid; place-items: center; flex: none; width: 32px; height: 32px; border-radius: 50%; color: var(--secondary-text-color, #646b75); background: color-mix(in srgb, var(--secondary-text-color, #646b75) 9%, transparent); }
    .glyph svg { width: 19px; height: 19px; }
    .good .glyph { color: var(--ob-battery, #009d91); background: color-mix(in srgb, var(--ob-battery, #009d91) 10%, transparent); }
    .warning .glyph { color: var(--warning-color, #9b7200); background: color-mix(in srgb, var(--warning-color, #9b7200) 10%, transparent); }
    .error .glyph { color: var(--error-color, #db4437); background: color-mix(in srgb, var(--error-color, #db4437) 9%, transparent); }
    .copy { display: flex; flex-direction: column; gap: 2px; align-self: center; min-width: 0; padding: 1px 0; }
    .title { font-size: 13px; line-height: 1.5; overflow-wrap: anywhere; }
    .detail { font-size: 12px; line-height: 1.5; color: var(--secondary-text-color, #646b75); overflow-wrap: anywhere; }
    .empty { margin: 0; padding: 8px 0 2px; color: var(--secondary-text-color, #646b75); font-size: 14px; line-height: 1.6; }
  `];

  protected render() {
    const s = this.snapshot;
    return html`
      <ha-card>
        ${this.renderHeader('Status')}
        ${this.renderNotice()}
        <div class="content">
          ${s.status.length ? html`<ul class="rows" aria-label="Omnibattery status">${s.status.map(row => this.row(row))}</ul>` : html`<p class="empty">Status readings are unavailable. Check that Omnibattery is connected and its status sensors are enabled.</p>`}
        </div>
      </ha-card>`;
  }

  private row(row: StatusRow) {
    const content = html`<span class="glyph" aria-hidden="true">${icon(this.statusIcon(row))}</span><span class="copy"><span class="title">${row.title}</span>${row.detail ? html`<span class="detail">${row.detail}</span>` : nothing}</span>`;
    const canInspect = row.entityId && /^(sensor|binary_sensor)\./.test(row.entityId);
    return html`<li class=${`row ${row.tone}`}>${canInspect
      ? html`<button class="status" @click=${() => this.moreInfo(row.entityId)} aria-label=${`${row.title}${row.detail ? `. ${row.detail}` : ''}. Show details`}>${content}</button>`
      : html`<div class="status">${content}</div>`}</li>`;
  }

  private statusIcon(row: StatusRow) {
    if (!row.icon.startsWith('mdi:')) return row.icon;
    const name = row.icon.slice(4);
    if (/clock|timer|calendar/.test(name)) return 'clock';
    if (/chart/.test(name)) return 'chart';
    if (/sunny|solar/.test(name)) return 'sun';
    if (/home/.test(name)) return 'home';
    if (/network|lan|connection/.test(name)) return 'connection';
    if (/shield|pause|lock|protect|reserve/.test(name)) return 'shield';
    if (/alert/.test(name)) return row.tone === 'good' ? 'check' : 'warning';
    if (/battery/.test(name)) return 'battery';
    if (/check/.test(name)) return 'check';
    return row.tone === 'warning' || row.tone === 'error' ? 'warning' : 'info';
  }
}
