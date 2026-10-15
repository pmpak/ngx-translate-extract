import fs from 'node:fs';
import * as os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { DirectiveParser } from '../../src/parsers/directive.parser.js';
import { FunctionParser } from '../../src/parsers/function.parser.js';
import { MarkerParser } from '../../src/parsers/marker.parser.js';
import { ParserInterface } from '../../src/parsers/parser.interface.js';
import { PipeParser } from '../../src/parsers/pipe.parser.js';
import { ServiceParser } from '../../src/parsers/service.parser.js';
import { TranslateFunctionParser } from '../../src/parsers/translate-function.parser.js';

interface ParserCase {
	name: string;
	parser: ParserInterface;
	filePath: string;
	/** Sources the parser really does extract from. `canMatch` must accept every one of them. */
	matching: string[];
}

const CASES: ParserCase[] = [
	{
		name: 'PipeParser',
		parser: new PipeParser(),
		filePath: 'test.template.html',
		matching: [
			`<p>{{ 'Hello world' | translate }}</p>`,
			`<p>{{   'odd.spacing'   |   translate   }}</p>`,
			`<p>{{ 'across.newlines'\n  | translate }}</p>`,
			`<p>{{ 'via.marker.pipe' | marker }}</p>`,
		],
	},
	{
		name: 'DirectiveParser',
		parser: new DirectiveParser(),
		filePath: 'test.template.html',
		matching: [`<span translate>Hello world</span>`, `<span [translate]="'bound.key'"></span>`, `<span marker>marker.key</span>`],
	},
	{
		name: 'ServiceParser',
		parser: new ServiceParser(),
		filePath: 'test.component.ts',
		matching: [
			`
				import { TranslateService } from '@ngx-translate/core';
				export class AppComponent {
					constructor(protected translateService: TranslateService) {
						translateService.get('constructor.injected');
					}
				}
			`,
			`
				import { inject } from '@angular/core';
				import { TranslateService } from '@ngx-translate/core';
				export class AppComponent {
					private translateService = inject(TranslateService);
					greet() {
						return this.translateService.instant('inject.form');
					}
				}
			`,
			`
				import { TranslateService } from '@ngx-translate/core';
				export class AppComponent {
					constructor(protected translateService: TranslateService) {
						translateService.stream('stream.method');
					}
				}
			`,
		],
	},
	{
		name: 'MarkerParser',
		parser: new MarkerParser(),
		filePath: 'test.component.ts',
		matching: [
			`
				import { marker } from '@biesbjerg/ngx-translate-extract-marker';
				marker('extract.marker.package');
			`,
			`
				import { _ } from '@ngx-translate/core';
				_('ngx.translate.marker');
			`,
			`
				import { _ } from '@ngx-translate/core';
				_
				('newline.before.paren');
			`,
		],
	},
	{
		name: 'TranslateFunctionParser',
		parser: new TranslateFunctionParser(),
		filePath: 'test.component.ts',
		matching: [
			`
				import { translate } from '@ngx-translate/core';
				translate('translate.function');
			`,
			`
				import { translate as t } from '@ngx-translate/core';
				t('aliased.translate.function');
			`,
		],
	},
	{
		name: 'FunctionParser',
		parser: new FunctionParser('MK'),
		filePath: 'test.component.ts',
		matching: [`MK('marker.function');`, `MK ('space.before.paren');`, `MK\n('newline.before.paren');`],
	},
];

describe('canMatch', () => {
	CASES.forEach(({ name, parser, filePath, matching }) => {
		describe(`${name}`, () => {
			it('should accept every source it extracts keys from', () => {
				matching.forEach((source) => {
					// If this fails the parser is about to be skipped for a file it would have found keys in.
					expect(parser.extract(source, filePath).keys().length, `expected keys from: ${source}`).to.be.greaterThan(0);
					expect(parser.canMatch?.(source), `canMatch rejected: ${source}`).to.equal(true);
				});
			});

			it('should reject a source with nothing to extract', () => {
				const source = filePath.endsWith('.html')
					? `<p>Nothing to see here</p>`
					: `export const answer = 42;\nconst snake_case_name = '__dirname';`;

				expect(parser.extract(source, filePath).keys()).to.deep.equal([]);
				expect(parser.canMatch?.(source)).to.equal(false);
			});
		});
	});

	describe('ServiceParser with an inherited TranslateService', () => {
		let tempDir: string;

		beforeEach(() => {
			tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ngxte-can-match-'));
		});

		afterEach(() => {
			fs.rmSync(tempDir, { recursive: true });
		});

		it('should accept a subclass whose base class (in another file) holds the TranslateService', () => {
			fs.writeFileSync(
				path.join(tempDir, 'base.ts'),
				`
					import { inject } from '@angular/core';
					import { TranslateService } from '@ngx-translate/core';
					export abstract class Base {
						protected readonly translate = inject(TranslateService);
						protected readonly typed: TranslateService;
					}
				`,
			);
			const source = `
				import { Component } from '@angular/core';
				import { Base } from './base';

				@Component({ selector: 'app-child', template: '' })
				export class ChildComponent extends Base {
					readonly title = this.typed.instant('inherited.service.key');
				}
			`;
			const parser = new ServiceParser();
			const filePath = path.join(tempDir, 'child.component.ts');

			expect(source).not.to.contain('TranslateService');
			expect(parser.extract(source, filePath).keys()).to.deep.equal(['inherited.service.key']);
			expect(parser.canMatch(source), 'canMatch rejected a subclass of a TranslateService holder').to.equal(true);
		});

		it('should accept a multi-level subclass', () => {
			fs.writeFileSync(path.join(tempDir, 'base.ts'), `export abstract class Base { protected translate: TranslateService; }`);
			fs.writeFileSync(
				path.join(tempDir, 'middle.ts'),
				`import { Base } from './base';\nexport abstract class Middle extends Base {}`,
			);
			const source = `
				import { Middle } from './middle';
				export class Leaf extends Middle {
					run() { this.translate.get('multi.level.key'); }
				}
			`;
			const parser = new ServiceParser();

			expect(parser.extract(source, path.join(tempDir, 'leaf.ts')).keys()).to.deep.equal(['multi.level.key']);
			expect(parser.canMatch(source)).to.equal(true);
		});
	});
});
