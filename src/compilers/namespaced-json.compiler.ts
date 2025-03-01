import { CompilerInterface, CompilerOptions } from './compiler.interface.js';
import {TranslationCollection, TranslationType} from '../utils/translation.collection.js';
import { stripBOM } from '../utils/utils.js';

import { flatten, unflatten } from 'flat';

export class NamespacedJsonCompiler implements CompilerInterface {
	public indentation: string = '\t';

	public extension = 'json';

	constructor(options?: CompilerOptions) {
		if (options && typeof options.indentation !== 'undefined') {
			this.indentation = options.indentation;
		}
	}

	public compile(collection: TranslationCollection): string {
		const values = unflatten(
			collection.toKeyValueObject(),
			{object: true}
		);
		return JSON.stringify(values, null, this.indentation);
	}

	public parse(contents: string): TranslationCollection {
		const values: Record<string, string> = flatten(JSON.parse(stripBOM(contents)));
		const newValues: TranslationType = {};
		Object.keys(values).forEach((key) => {
			newValues[key] = {value: values[key], sourceFiles: []}
		});
		return new TranslationCollection(newValues);
	}
}
