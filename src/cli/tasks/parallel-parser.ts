import { availableParallelism } from 'node:os';
import { Worker } from 'node:worker_threads';

import { TranslationType } from '../../utils/translation.collection.js';
import { logProgress } from '../../utils/cli-utils.js';

const threadAmount = Math.floor(availableParallelism() * 0.75) || 1; // ~75% of the CPU
const EXTRACT_WORKER_POOL = Array.from({ length: threadAmount }, () => new Worker(new URL('./extract-worker.js', import.meta.url)));

export async function parseFiles(filesPaths: string[]) {
	const filePathsChunks = chunkArray(filesPaths, EXTRACT_WORKER_POOL.length)

	const allExtracted: TranslationType[] = [];
	let filesParsed = 0;
	for (const paths of filePathsChunks) {
		const promises = paths.map((filePath, index) => runParserInWorker(filePath, EXTRACT_WORKER_POOL[index]));

		const extracted = await Promise.all(promises);

		allExtracted.push(...extracted.flat());

		filesParsed += paths.length
		logProgress(filesParsed, filesPaths.length);
	}

	return allExtracted;
}

async function runParserInWorker(filePath: string, worker: Worker): Promise<TranslationType[]> {
	return new Promise((resolve, reject) => {
		worker.once('error', reject);
		worker.once('exit', (code) => {
			if (code !== 0) reject(new Error(`Worker exited with code ${code}`));
		});

		worker.once('message', (message: TranslationType[]) => {
			worker.removeAllListeners('error');
			worker.removeAllListeners('exit');
			resolve(message);
		})

		worker.postMessage({ filePath });
	});
}

function chunkArray<T>(array: T[], chunkSize: number): T[][] {
	const chunks: T[][] = [];
	for (let i = 0; i < array.length; i += chunkSize) {
		chunks.push(array.slice(i, i + chunkSize));
	}
	return chunks;
}
