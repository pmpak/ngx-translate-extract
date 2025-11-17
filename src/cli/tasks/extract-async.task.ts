import { cyan, green, bold, dim, red, yellow } from './../../utils/cli-color.js';
import { glob } from 'glob';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import { TranslationCollection, TranslationType } from '../../utils/translation.collection.js';
import { ParserInterface } from '../../parsers/parser.interface.js';
import { PostProcessorInterface } from '../../post-processors/post-processor.interface.js';
import { CompilerInterface } from '../../compilers/compiler.interface.js';
import type { CacheInterface } from '../../cache/cache-interface.js';
import { NullCache } from '../../cache/null-cache.js';
import { parseFiles } from './parallel-parser.js';
import { hideCursor, showCursor } from '../../utils/cli-utils.js';
import { isDirectory, pathExists } from '../../utils/fs-helpers.js';

export interface ExtractTaskOptionsInterface {
	replace?: boolean;
}

export class ExtractAsyncTask {
	protected options: ExtractTaskOptionsInterface = {
		replace: false
	};

	protected parsers: ParserInterface[] = [];
	protected postProcessors: PostProcessorInterface[] = [];
	protected compiler: CompilerInterface;
	protected cache: CacheInterface<TranslationType[]> = new NullCache<TranslationType[]>();

	public constructor(protected inputs: string[], protected outputs: string[], options?: ExtractTaskOptionsInterface) {
		this.inputs = inputs.map((input) => path.resolve(input));
		this.outputs = outputs.map((output) => path.resolve(output));
		this.options = { ...this.options, ...options };
	}

	public async execute(): Promise<void> {
		if (!this.compiler) {
			throw new Error('No compiler configured');
		}

		// this.printEnabledParsers();
		// this.printEnabledPostProcessors();
		// this.printEnabledCompiler();
		this.out('ngx-translate-extract');
		const extracted = await this.extract();
		this.out(green('\nFound %d strings.\n'), extracted.count());

		this.out(bold('Saving:'));

		await Promise.all(this.outputs.map((output) => this.saveToFile(output, extracted)));

		this.cache.persist();
	}


	private async saveToFile(output: string, extracted: TranslationCollection) {
		let dir: string = output;
		let filename: string = `strings.${this.compiler.extension}`;
		if (!(await pathExists(output)) || !(await isDirectory(output))) {
			dir = path.dirname(output);
			filename = path.basename(output);
		}

		const outputPath: string = path.join(dir, filename);
		const outputPathExists = await pathExists(outputPath);

		let existing: TranslationCollection = new TranslationCollection();
		if (!this.options.replace && outputPathExists) {
			try {
				existing = this.compiler.parse(await fs.readFile(outputPath, 'utf-8'));
			} catch (e) {
				this.out('%s %s', dim(`- ${outputPath}`), red('[ERROR]'));
				throw e;
			}
		}

		// merge extracted strings with existing
		const draft = extracted.union(existing);

		// Run collection through post processors
		const final = this.process(draft, extracted, existing);

		// Save
		try {
			let event = 'CREATED';
			if (outputPathExists) {
				this.options.replace ? (event = 'REPLACED') : (event = 'MERGED');
			}
			await this.save(outputPath, final);
			this.out('%s %s', dim(`- ${outputPath}`), green(`[${event}]`));
		} catch (e) {
			this.out('%s %s', dim(`- ${outputPath}`), red('[ERROR]'));
			throw e;
		}
	}

	public setParsers(parsers: ParserInterface[]): this {
		this.parsers = parsers;
		return this;
	}

	public setCache(cache: CacheInterface<TranslationType[]>): this {
		this.cache = cache;
		return this;
	}

	public setPostProcessors(postProcessors: PostProcessorInterface[]): this {
		this.postProcessors = postProcessors;
		return this;
	}

	public setCompiler(compiler: CompilerInterface): this {
		this.compiler = compiler;
		return this;
	}

	/**
	 * Extract strings from specified input dirs using configured parsers
	 */
	protected async extract() {
		console.log(yellow('●'), 'Resolving file paths');
		const filePaths = (await Promise.all(this.inputs.map((pattern) => this.getFiles(pattern)))).flat();
		console.log(green('✔'), 'Found', filePaths.length, 'files.');

		console.log(bold('Extracting:'));
		hideCursor();
		const extractedCollectionTypes = await parseFiles(filePaths);
		showCursor();

		const values: TranslationType = {};
		for (const collectionType of extractedCollectionTypes) {
			Object.assign(values, collectionType);
		}

		return new TranslationCollection(values);
	}

	/**
	 * Run strings through configured post processors
	 */
	protected process(draft: TranslationCollection, extracted: TranslationCollection, existing: TranslationCollection): TranslationCollection {
		this.postProcessors.forEach((postProcessor) => {
			draft = postProcessor.process(draft, extracted, existing);
		});
		return draft;
	}

	/**
	 * Compile and save translations
	 * @param output
	 * @param collection
	 */
	protected async save(output: string, collection: TranslationCollection): Promise<void> {
		const dir = path.dirname(output);

		if (!(await pathExists(dir))) {
			await fs.mkdir(dir, { recursive: true });
		}

		return fs.writeFile(output, this.compiler.compile(collection));
	}

	/**
	 * Get all files matching pattern
	 */
	protected getFiles(pattern: string): Promise<string[]> {
		// Ensure that the pattern consistently uses forward slashes ("/")
		// for cross-platform compatibility, as Glob patterns should always use "/"
		const sanitizedPattern = pattern.split(path.sep).join(path.posix.sep);
		return glob(sanitizedPattern, {nodir: true});
	}

	protected out(...args: unknown[]): void {
		console.log.apply(this, args);
	}

	protected printEnabledParsers(): void {
		this.out(cyan('Enabled parsers:'));
		if (this.parsers.length) {
			this.out(cyan(dim(this.parsers.map((parser) => `- ${parser.constructor.name}`).join('\n'))));
		} else {
			this.out(cyan(dim('(none)')));
		}
		this.out();
	}

	protected printEnabledPostProcessors(): void {
		this.out(cyan('Enabled post processors:'));
		if (this.postProcessors.length) {
			this.out(cyan(dim(this.postProcessors.map((postProcessor) => `- ${postProcessor.constructor.name}`).join('\n'))));
		} else {
			this.out(cyan(dim('(none)')));
		}
		this.out();
	}

	protected printEnabledCompiler(): void {
		this.out(cyan('Compiler:'));
		this.out(cyan(dim(`- ${this.compiler.constructor.name}`)));
		this.out();
	}
}

