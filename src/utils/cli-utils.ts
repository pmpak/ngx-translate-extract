import {stdout} from 'node:process';

import { green, yellow } from './cli-color.js';

export function logProgress(current: number, total: number) {
	stdout.write(`\r${progress(current, total)}`);
}

export function hideCursor() {
	stdout.write('\u001B[?25l');
}
export function showCursor() {
	stdout.write('\u001B[?25h');
}

function progress(current: number, total: number): string {
	const icon = current === total ? green('✔') : yellow('●');
	return `${icon} ${current}/${total} (${Math.round(((current) / total) * 100)}%)`;
}
