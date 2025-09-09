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

parentPort.on('message', ({contents, filePath, customMarkerName}) => {
	if (customMarkerName) {
		parsers.set('MarkerParser', new FunctionParser(customMarkerName));
	}

	const translations: TranslationType[] = [];

	for (const parser of parsers.values()) {
		const extracted = parser.extract(contents, filePath);
		if (!extracted || extracted.count() === 0) {
			continue;
		}
		translations.push(extracted.values);
	}

	parentPort.postMessage(translations);
});
