import type { Appearance } from './types';

export const basicAppearanceFields = [
  ['background', 'Background color', 'color', '--ob-background'],
  ['text_color', 'Text color', 'color', '--ob-text'],
  ['secondary_text_color', 'Secondary text color', 'color', '--ob-secondary'],
  ['border_color', 'Border color', 'color', '--ob-border-color'],
  ['border_width', 'Border width', 'number', '--ob-border-width', 0, 8],
  ['border_radius', 'Corner radius', 'number', '--ob-radius', 0, 48],
  ['padding', 'Padding', 'number', '--ob-padding', 0, 48],
  ['title_size', 'Title font size', 'number', '--ob-title-size', 10, 36],
  ['value_size', 'Value font size', 'number', '--ob-value-size', 10, 48],
  ['shadow', 'Shadow', 'shadow', '--ob-shadow'],
] as const;

export const advancedAppearanceFields = [
  ['hover_color', 'Hover background', 'color', '--ob-hover'],
  ['pressed_color', 'Pressed background', 'color', '--ob-pressed'],
  ['focus_color', 'Focus outline', 'color', '--ob-focus'],
  ['solar_color', 'Solar color', 'color', '--ob-solar'],
  ['home_color', 'Home consumption color', 'color', '--ob-home'],
  ['grid_color', 'Grid import color', 'color', '--ob-grid'],
  ['export_color', 'Grid export color', 'color', '--ob-export'],
  ['charge_color', 'Battery charge color', 'color', '--ob-charge'],
  ['battery_color', 'Battery discharge color', 'color', '--ob-battery'],
  ['soc_color', 'Charge level color', 'color', '--ob-soc'],
  ['price_color', 'Price color', 'color', '--ob-price'],
  ['warning_color', 'Warning color', 'color', '--ob-warning'],
  ['success_color', 'Success color', 'color', '--ob-good'],
  ['error_color', 'Error color', 'color', '--ob-error'],
  ['divider_color', 'Divider color', 'color', '--ob-line'],
  ['subtle_color', 'Subtle surface color', 'color', '--ob-subtle'],
] as const;

export const appearanceFields = [...basicAppearanceFields, ...advancedAppearanceFields] as const;

type AppearanceField = typeof appearanceFields[number];

function validateSetting(field: AppearanceField, setting: unknown) {
  const [key, , kind] = field;
  if (kind === 'number') {
    validateSize(key, setting, field[4], field[5]);
    return;
  }
  const property = kind === 'color' ? 'color' : 'box-shadow';
  if (typeof setting === 'string' && setting.trim() && CSS.supports(property, setting)) return;
  throw new Error(`${key} must be a valid CSS ${kind === 'color' ? 'color' : 'box shadow'}.`);
}

function validateSize(key: string, value: unknown, min: number, max: number) {
  if (typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max) return;
  throw new Error(`${key} must be between ${min} and ${max} pixels.`);
}

export function validateAppearance(value: unknown): asserts value is Appearance | undefined {
  if (value === undefined) return;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('appearance must be an object.');
  for (const [key, setting] of Object.entries(value)) {
    const field = appearanceFields.find(f => f[0] === key);
    if (!field) throw new Error(`Unknown appearance option: ${key}`);
    validateSetting(field, setting);
  }
}

export function applyAppearance(host: HTMLElement, appearance?: Appearance) {
  for (const [key, , type, variable] of appearanceFields) {
    const value = appearance?.[key];
    if (value === undefined) host.style.removeProperty(variable);
    else host.style.setProperty(variable, type === 'number' ? `${value}px` : String(value));
  }
}
