import type { ExtensionContext } from 'vscode';

export function activate(_context: ExtensionContext): void {
	// Grammar-based highlighting is declarative; no runtime activation needed.
}

export function deactivate(): void {
	// Nothing to dispose.
}
