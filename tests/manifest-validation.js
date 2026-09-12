// tests/manifest-validation.js
import fs from 'fs';
import path from 'path';

function testManifest() {
  const manifestPath = path.resolve('manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error('manifest.json missing');
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  if (manifest.manifest_version !== 3) {
    throw new Error(`manifest_version must be 3, found: ${manifest.manifest_version}`);
  }
  if (!manifest.action?.default_popup) {
    throw new Error('action.default_popup missing');
  }

  const requiredPerms = ['tabs', 'scripting', 'storage', 'clipboardWrite'];
  for (const p of requiredPerms) {
    if (!manifest.permissions?.includes(p)) {
      throw new Error(`Permission ${p} missing`);
    }
  }

  for (const size of ['16', '48', '128']) {
    if (!manifest.icons?.[size]) {
      throw new Error(`Icon definition for ${size} missing in manifest`);
    }
    const iconPath = path.resolve(manifest.icons[size]);
    if (!fs.existsSync(iconPath)) {
      throw new Error(`Icon ${size} missing at ${iconPath}`);
    }
  }
  console.log('✅ Manifest and icon validation test passed successfully!');
}

try {
  testManifest();
} catch (err) {
  console.error('❌ Manifest validation failed:', err.message);
  process.exit(1);
}
