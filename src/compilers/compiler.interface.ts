import { TranslationCollection } from '../utils/translation.collection.js';

export interface CompilerOptions {
	indentation?: string;
}

export interface CompilerInterface {
	extension: string;

	compile(collection: TranslationCollection): string;

	parse(contents: string): TranslationCollection;
}
