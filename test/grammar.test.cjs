const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { before, test } = require('node:test');
const { loadWASM, OnigScanner, OnigString } = require('vscode-oniguruma');
const { Registry, parseRawGrammar } = require('vscode-textmate');

const root = join(__dirname, '..');
let grammar;

before(async () => {
	const wasm = readFileSync(require.resolve('vscode-oniguruma/release/onig.wasm'));
	await loadWASM(wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength));
	const registry = new Registry({
		onigLib: Promise.resolve({
			createOnigScanner: patterns => new OnigScanner(patterns),
			createOnigString: value => new OnigString(value),
		}),
		loadGrammar: scope => scope === 'source.ben'
			? Promise.resolve(parseRawGrammar(
				readFileSync(join(root, 'syntaxes/ben.tmLanguage.json'), 'utf8'),
				join(root, 'syntaxes/ben.tmLanguage.json'),
			))
			: Promise.resolve(null),
	});
	grammar = await registry.loadGrammar('source.ben');
});

function hasScope(line, text, scope) {
	return grammar.tokenizeLine(line).tokens.some(token =>
		line.slice(token.startIndex, token.endIndex).includes(text) && token.scopes.includes(scope));
}

test('headings keep numbers, slashes, ampersands, and child scopes', () => {
	assert.ok(hasScope('Q4 / R&D', 'Q4 / R&D', 'markup.heading.ben'));
	assert.ok(hasScope('    CHILD 2 / R&D', 'CHILD 2 / R&D', 'markup.heading.child.ben'));
});

test('notes keep note, metadata, and URL scopes', () => {
	const note = 'Review details(due Friday) at https://example.com';
	assert.ok(hasScope(note, 'Review details', 'string.unquoted.ben'));
	assert.ok(hasScope(note, '(due Friday)', 'string.quoted.other.ben'));
	assert.ok(hasScope(note, 'https://example.com', 'markup.underline.link.ben'));
});

test('all task states keep state, metadata, and URL scopes', () => {
	for (const [marker, state] of [['X', 'done'], ['O', 'active'], ['W', 'waiting'], ['T', 'target']]) {
		const line = `${marker} - Task(due Friday) https://example.com`;
		assert.ok(hasScope(line, marker, `keyword.control.${state}.ben`));
		assert.ok(hasScope(line, 'Task', `meta.task.${state}.ben`));
		assert.ok(hasScope(line, '(due Friday)', 'string.quoted.other.ben'));
		assert.ok(hasScope(line, 'https://example.com', 'markup.underline.link.ben'));
	}
	assert.ok(hasScope('    - Nested task', '-', 'keyword.control.notstarted.ben'));
});

test('manifest paths and snippet prefixes are valid', () => {
	const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
	assert.equal(manifest.main, undefined);
	for (const contribution of ['languages', 'grammars', 'snippets']) {
		assert.ok(manifest.contributes[contribution].length > 0);
	}
	const snippets = JSON.parse(readFileSync(join(root, 'snippets/ben.code-snippets'), 'utf8'));
	assert.deepEqual(
		Object.values(snippets).map(snippet => snippet.prefix).sort(),
		['ben-o', 'ben-sub', 'ben-t', 'ben-task', 'ben-w', 'ben-x'],
	);
});
