import { availableParallelism } from 'node:os';
import { Worker } from 'node:worker_threads';
import { green, yellow } from 'colorette';

import { TranslationType } from '../../utils/translation.collection.js';
import { logProgress } from '../../utils/logger-helpers.js';

const threadAmount = Math.floor(availableParallelism() * 0.75) || 1; // ~75% of the CPU
const WORKERS = Array.from({ length: threadAmount }, () => new Worker(new URL('./extract-worker.js', import.meta.url)));

export async function parseFiles(files: { filePath: string, contents: string }[]) {
	const fileChunks = chunkArray(files, WORKERS.length)

	const allExtracted: TranslationType[] = [];
	let filesParsed = 0;
	for (const chunk of fileChunks) {
		const promises = chunk.map(({filePath, contents}, index) => {
			filesParsed++;

			logProgress(filesParsed, files.length);
			return runParserInWorker(contents, filePath, WORKERS[index]);
		});
		const extracted = await Promise.all(promises);
		allExtracted.push(...extracted.flat());
	}

	return allExtracted;
}

async function runParserInWorker(contents: string, filePath: string, worker: Worker): Promise<TranslationType[]> {
	return new Promise((resolve, reject) => {
		worker.once('message', (message: TranslationType[]) => {
			worker.removeAllListeners('error');
			worker.removeAllListeners('exit');
			resolve(message);
		});
		worker.once('error', reject);
		worker.once('exit', (code) => {
			if (code !== 0) reject(new Error(`Worker exited with code ${code}`));
		});

		worker.postMessage({ contents, filePath });
	});
}

function chunkArray<T>(array: T[], chunkSize: number): T[][] {
	const chunks: T[][] = [];
	for (let i = 0; i < array.length; i += chunkSize) {
		chunks.push(array.slice(i, i + chunkSize));
	}
	return chunks;
}
