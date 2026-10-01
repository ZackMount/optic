import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { mkdir, copyFile, readFile, writeFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const dist = dirname(require.resolve('@imagemagick/magick-wasm'));
const destination = join(process.cwd(), 'public', 'vendor', 'magick');
await mkdir(destination, { recursive: true });
await Promise.all([
  copyFile(join(dist, 'x86', 'magick.wasm'), join(destination, 'magick.wasm')),
  copyFile(join(dist, '..', 'LICENSE'), join(destination, 'LICENSE')),
  copyFile(join(dist, '..', 'NOTICE'), join(destination, 'NOTICE')),
  copyFile(join(process.cwd(), 'scripts', 'assets', 'srgb.icc'), join(destination, 'srgb.icc')),
  copyFile(join(process.cwd(), 'scripts', 'assets', 'COLOR-PROFILE-LICENSE'), join(destination, 'COLOR-PROFILE-LICENSE')),
]);
const pkg = JSON.parse(await readFile(join(dist, '..', 'package.json'), 'utf8'));
await writeFile(join(destination, 'version.json'), JSON.stringify({ version: pkg.version }));
console.log(`Prepared local ImageMagick/WASM ${pkg.version} assets.`);
