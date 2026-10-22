import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
const root = new URL('../', import.meta.url);
const pkg = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'));
const manifest = JSON.parse(readFileSync(new URL('custom_components/omnibattery_cards/manifest.json', root), 'utf8'));
if (pkg.version !== manifest.version) throw new Error('Card and integration versions must match');
const frontend = new URL('custom_components/omnibattery_cards/frontend/', root);
mkdirSync(frontend, {recursive: true});
copyFileSync(new URL('dist/omnibattery-cards.js', root), new URL('omnibattery-cards.js', frontend));
