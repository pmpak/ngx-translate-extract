import { po } from 'gettext-parser';

import { CompilerInterface } from './compiler.interface.js';
import { TranslationCollection, TranslationInterface, TranslationType } from '../utils/translation.collection.js';

interface PoTranslation {
	msgctxt: string;
	msgid: string;
	msgstr: string[];
	obsolete: boolean;
	comments?: {
		translator?: string;
		extracted?: string;
		reference?: string;
		flag?: string;
		previous?: string;
	};
}

interface PoTranslationCollection {
	[domain: string]: {
		[msgid: string]: PoTranslation;
	};
}

export class PoCompiler implements CompilerInterface {
	public extension: string = 'po';

	/**
	 * Translation domain
	 */
	public domain: string = '';

	public constructor(options?: any) {}

	public compile(collection: TranslationCollection): string {
		const data = {
			charset: 'utf-8',
			headers: {
				'mime-version': '1.0',
				'content-type': 'text/plain; charset=utf-8',
				'content-transfer-encoding': '8bit'
			},
			translations: {
				[this.domain]: Object.keys(collection.values)
					.reduce(
						(translations, key) => {
							const entry: TranslationInterface = collection.get(key);
							return {
								...translations,
								[key]: {
									msgid: key,
									msgstr: entry.value,
									comments: {reference: entry.sourceFiles?.join('\n')}
								}
							};
						},
						{} as any
					)
			}
		};

		return po.compile(data, {}).toString('utf8');
	}

	public parse(contents: string): TranslationCollection {
		const parsedPo = po.parse(contents, { defaultCharset: 'utf8' });
		const translations = 'translations' in parsedPo && (parsedPo.translations as PoTranslationCollection);

		if (!translations[this.domain]) {
			return new TranslationCollection();
		}

		const values: TranslationType = {};
		Object.entries(translations[this.domain])
			.filter(([msgid]) => msgid !== '')
			.forEach(([msgid, message]) => {
				values[msgid] = {
					value: message.msgstr.at(-1),
					sourceFiles: message.comments?.reference?.split('\n') || []
				};
			});

		return new TranslationCollection(values);
	}
}
