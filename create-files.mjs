import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM __dirname workaround
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sourceFile = path.join(__dirname, 'tests/cli/fixtures/translate-service.component.fixture.ts');
const destinationDir = path.join(__dirname, 'mocks');
const baseReplace = 'translate-service.comp';

// Number of copies to create (set this to your desired value)
const N = 2000;

// Ensure destination directory exists
if (!fs.existsSync(destinationDir)) {
	fs.mkdirSync(destinationDir, { recursive: true });
}

// Read the source file (sync)
let data;
try {
	data = fs.readFileSync(sourceFile, 'utf8');
} catch (err) {
	console.error(`Failed to read file: ${sourceFile}`, err);
	process.exit(1);
}

for (let i = 1; i <= N; i++) {
	// Escape baseReplace for RegExp
	const baseReplaceEscaped = baseReplace.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
	const replaced = data.replace(
		new RegExp(baseReplaceEscaped, 'g'),
		`${baseReplace}-${i}`
	);
	const destFile = path.join(destinationDir, `translate-service.component.fixture-${i}.ts`);
	try {
		fs.writeFileSync(destFile, replaced);
		console.log(`Created: ${destFile}`);
	} catch (err) {
		console.error(`Failed to write file: ${destFile}`, err);
	}
}
