import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const dependencies = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });

if (dependencies.includes(pkg.name)) {
  console.error(`package name "${pkg.name}" collides with a dependency of the same name`);
  process.exit(1);
}

console.log(`self-reference: ok (${pkg.name} vs ${dependencies.length} deps)`);
