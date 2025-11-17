import { readFileSync } from 'node:fs';
import { parentPort } from 'node:worker_threads';

import { PipeParser } from '../../parsers/pipe.parser.js';
import { DirectiveParser } from '../../parsers/directive.parser.js';
import { ServiceParser } from '../../parsers/service.parser.js';
import { FunctionParser } from '../../parsers/function.parser.js';
import { MarkerParser } from '../../parsers/marker.parser.js';
import { ParserInterface } from '../../parsers/parser.interface.js';
import { TranslationType } from '../../utils/translation.collection.js';

const parsers = new Map<string, ParserInterface>([
	['PipeParser', new PipeParser()],
	['DirectiveParser', new DirectiveParser()],
	['ServiceParser', new ServiceParser()],
	['MarkerParser', new MarkerParser()],
]);

parentPort.on('message', ({filePath, customMarkerName}) => {
	if (customMarkerName) {
		parsers.set('MarkerParser', new FunctionParser(customMarkerName));
	}

	const translations: TranslationType[] = [];

	const fileContents = readFileSync(filePath, { encoding: 'utf8' });

	for (const parser of parsers.values()) {
		const extracted = parser.extract(fileContents, filePath);
		if (!extracted || extracted.count() === 0) {
			continue;
		}
		translations.push(extracted.values);
	}

	parentPort.postMessage(translations);
});
