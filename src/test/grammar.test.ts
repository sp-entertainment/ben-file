import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import { Registry, parseRawGrammar, IGrammar, StateStack } from 'vscode-textmate';
import { loadWASM, OnigScanner, OnigString } from 'vscode-oniguruma';

const GRAMMAR_PATH = path.resolve(__dirname, '../../syntaxes/ben.tmLanguage.json');
const WASM_PATH = path.resolve(__dirname, '../../node_modules/vscode-oniguruma/release/onig.wasm');

interface Token {
	text: string;
	scopes: string[];
}

let grammar: IGrammar;

function tokenizeLine(line: string, prevState: StateStack | null = null): { tokens: Token[]; ruleStack: StateStack } {
	const result = grammar.tokenizeLine(line, prevState);
	const tokens: Token[] = result.tokens.map(t => ({
		text: line.substring(t.startIndex, t.endIndex),
		scopes: t.scopes,
	}));
	return { tokens, ruleStack: result.ruleStack };
}

function hasScope(tokens: Token[], text: string, scope: string): boolean {
	return tokens.some(t => t.text.includes(text) && t.scopes.some(s => s.includes(scope)));
}

async function initGrammar(): Promise<void> {
	const wasmBin = fs.readFileSync(WASM_PATH).buffer;
	await loadWASM({ data: wasmBin });

	const registry = new Registry({
		onigLib: Promise.resolve({
			createOnigScanner(patterns: string[]) { return new OnigScanner(patterns); },
			createOnigString(s: string) { return new OnigString(s); },
		}),
		loadGrammar(scopeName: string) {
			if (scopeName === 'source.ben') {
				const content = fs.readFileSync(GRAMMAR_PATH, 'utf-8');
				return Promise.resolve(parseRawGrammar(content, GRAMMAR_PATH));
			}
			return Promise.resolve(null);
		},
	});

	const g = await registry.loadGrammar('source.ben');
	if (!g) { throw new Error('Failed to load grammar'); }
	grammar = g;
}

suite('Ben Grammar', function () {
	this.timeout(10000);

	suiteSetup(async () => {
		await initGrammar();
	});

	suite('Headings', () => {
		test('simple heading', () => {
			const { tokens } = tokenizeLine('REMINDERS');
			assert.ok(hasScope(tokens, 'REMINDERS', 'markup.heading.ben'), 'heading should have markup.heading.ben scope');
		});

		test('heading with spaces', () => {
			const { tokens } = tokenizeLine('WORKING QUEUE');
			assert.ok(hasScope(tokens, 'WORKING QUEUE', 'markup.heading.ben'));
		});

		test('heading with numbers', () => {
			const { tokens } = tokenizeLine('ECHOS APP MVP 2');
			assert.ok(hasScope(tokens, 'ECHOS APP MVP 2', 'markup.heading.ben'));
		});

		test('indented heading', () => {
			const { tokens } = tokenizeLine('\tMAIN');
			assert.ok(hasScope(tokens, 'MAIN', 'markup.heading.ben'));
		});
	});

	suite('Notes', () => {
		test('simple note', () => {
			const { tokens } = tokenizeLine('Feeling overwhelmed is a sign that I need to get organized.');
			assert.ok(hasScope(tokens, 'Feeling', 'string.unquoted.ben'), 'note should have string.unquoted.ben scope');
		});

		test('indented note', () => {
			const { tokens } = tokenizeLine('\tlight and dark mode');
			assert.ok(hasScope(tokens, 'light', 'string.unquoted.ben'));
		});

		test('nested note with deeper indentation', () => {
			const { tokens } = tokenizeLine('\t\task to refile with referral');
			assert.ok(hasScope(tokens, 'ask', 'string.unquoted.ben'));
		});
	});

	suite('Tasks - Not Started', () => {
		test('simple task', () => {
			const { tokens } = tokenizeLine('- Call Uncle Bob');
			assert.ok(hasScope(tokens, '-', 'punctuation.definition.list.begin.ben'), 'dash should be punctuation');
		});

		test('indented task', () => {
			const { tokens } = tokenizeLine('\t- Start gemini chat');
			assert.ok(hasScope(tokens, '-', 'punctuation.definition.list.begin.ben'));
		});
	});

	suite('Tasks - Done (X)', () => {
		test('done task has X with keyword control scope', () => {
			const { tokens } = tokenizeLine('X - Work with Claude code');
			assert.ok(hasScope(tokens, 'X', 'keyword.control.ben'), 'X marker should be keyword.control.ben');
		});

		test('done task text uses neutral task scope', () => {
			const { tokens } = tokenizeLine('X - Work with Claude code');
			assert.ok(hasScope(tokens, 'Work with Claude code', 'meta.task.ben'), 'done task text should be meta.task.ben');
		});

		test('done task dash is punctuation', () => {
			const { tokens } = tokenizeLine('X - Work with Claude code');
			assert.ok(hasScope(tokens, '-', 'punctuation.definition.list.begin.ben'));
		});

		test('indented done task', () => {
			const { tokens } = tokenizeLine('\tX - investigate plugins');
			assert.ok(hasScope(tokens, 'X', 'keyword.control.ben'));
			assert.ok(hasScope(tokens, 'investigate plugins', 'meta.task.ben'));
		});
	});

	suite('Tasks - Active (O)', () => {
		test('active task has O with inserted markup scope', () => {
			const { tokens } = tokenizeLine('O - Create lg tv remote app');
			assert.ok(hasScope(tokens, 'O', 'markup.inserted.ben'), 'O marker should be markup.inserted.ben');
		});

		test('active task text is neutral task scope', () => {
			const { tokens } = tokenizeLine('O - Create lg tv remote app');
			assert.ok(hasScope(tokens, 'Create lg tv remote app', 'meta.task.ben'));
		});

		test('indented active task', () => {
			const { tokens } = tokenizeLine('\tO - Scan letter');
			assert.ok(hasScope(tokens, 'O', 'markup.inserted.ben'));
		});
	});

	suite('Tasks - Waiting (W)', () => {
		test('waiting task has W with changed markup scope', () => {
			const { tokens } = tokenizeLine('W - task that is waiting');
			assert.ok(hasScope(tokens, 'W', 'markup.changed.ben'), 'W marker should be markup.changed.ben');
		});

		test('waiting task text is neutral task scope', () => {
			const { tokens } = tokenizeLine('W - task that is waiting');
			assert.ok(hasScope(tokens, 'task that is waiting', 'meta.task.ben'));
		});
	});

	suite('Meta Information', () => {
		test('meta info in parentheses on a task', () => {
			const { tokens } = tokenizeLine('- File SPE fillings(due soon)');
			assert.ok(hasScope(tokens, '(due soon)', 'string.quoted.other.ben'), 'meta should be string.quoted.other.ben');
		});

		test('meta info with date', () => {
			const { tokens } = tokenizeLine('- Get insurance for the house(due April 04)');
			assert.ok(hasScope(tokens, '(due April 04)', 'string.quoted.other.ben'));
		});

		test('meta info on done task', () => {
			const { tokens } = tokenizeLine('X - Work with Claude code for a week(03/09/2026)');
			assert.ok(hasScope(tokens, '(03/09/2026)', 'string.quoted.other.ben'));
		});
	});

	suite('Nesting preserves scopes', () => {
		test('deeply nested task retains scopes', () => {
			const { tokens } = tokenizeLine('\t\t- another nested task');
			assert.ok(hasScope(tokens, '-', 'punctuation.definition.list.begin.ben'));
		});

		test('deeply nested done task retains X scope', () => {
			const { tokens } = tokenizeLine('\t\tX - deeply nested done');
			assert.ok(hasScope(tokens, 'X', 'keyword.control.ben'));
			assert.ok(hasScope(tokens, 'deeply nested done', 'meta.task.ben'));
		});

		test('space-indented task', () => {
			const { tokens } = tokenizeLine('    - space indented task');
			assert.ok(hasScope(tokens, '-', 'punctuation.definition.list.begin.ben'));
		});

		test('space-indented done task', () => {
			const { tokens } = tokenizeLine('    X - space indented done');
			assert.ok(hasScope(tokens, 'X', 'keyword.control.ben'));
		});
	});

	suite('Edge cases', () => {
		test('single word heading', () => {
			const { tokens } = tokenizeLine('DONE');
			assert.ok(hasScope(tokens, 'DONE', 'markup.heading.ben'));
		});

		test('mixed case is note, not heading', () => {
			const { tokens } = tokenizeLine('Description');
			assert.ok(hasScope(tokens, 'Description', 'string.unquoted.ben'));
			assert.ok(!hasScope(tokens, 'Description', 'markup.heading.ben'));
		});

		test('lowercase text is note', () => {
			const { tokens } = tokenizeLine('light and dark mode');
			assert.ok(hasScope(tokens, 'light', 'string.unquoted.ben'));
		});

		test('task with only dash and space', () => {
			const { tokens } = tokenizeLine('- task');
			assert.ok(hasScope(tokens, '-', 'punctuation.definition.list.begin.ben'));
		});

		test('heading with slash', () => {
			const { tokens } = tokenizeLine('TV REMOTE CONTROL APP');
			assert.ok(hasScope(tokens, 'TV REMOTE CONTROL APP', 'markup.heading.ben'));
		});
	});
});
