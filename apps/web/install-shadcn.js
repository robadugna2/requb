const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const components = [
  'skeleton', 'input', 'dialog', 'alert', 'scroll-area', 'breadcrumb', 'badge'
];

const UI_DIR = path.join(__dirname, 'src', 'components', 'ui');
if (!fs.existsSync(UI_DIR)) {
  fs.mkdirSync(UI_DIR, { recursive: true });
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve(null); }
      });
    }).on('error', reject);
  });
}

async function installComponent(name, installed = new Set()) {
  if (installed.has(name)) return;
  installed.add(name);
  
  const expectedFile = path.join(UI_DIR, `${name}.tsx`);
  if (fs.existsSync(expectedFile)) {
    console.log(`Skipping ${name}, already exists`);
    return;
  }
  
  console.log(`Fetching ${name}...`);
  const data = await fetchJson(`https://ui.shadcn.com/r/styles/new-york/${name}.json`);
  if (!data) {
    console.log(`Failed to fetch ${name}`);
    return;
  }
  
  // Install dependencies
  const deps = [...(data.dependencies || [])];
  if (deps.length > 0) {
    console.log(`Installing dependencies for ${name}: ${deps.join(', ')}`);
    execSync(`npm install ${deps.join(' ')}`, { stdio: 'inherit' });
  }

  // Install registry dependencies recursively
  for (const regDep of (data.registryDependencies || [])) {
    await installComponent(regDep, installed);
  }

  // Write files
  for (const file of data.files) {
    const fileName = path.basename(file.path);
    const destPath = path.join(UI_DIR, fileName);
    fs.writeFileSync(destPath, file.content);
    console.log(`Created ${destPath}`);
  }
}

async function main() {
  const installed = new Set();
  for (const comp of components) {
    await installComponent(comp, installed);
  }
  console.log('All components installed!');
}

main().catch(console.error);
