# API Reference

This document provides comprehensive documentation for the MintMind API, including core interfaces, extension points, and usage examples.

## Table of Contents

- [Core Interfaces](#core-interfaces)
- [Extension API](#extension-api)
- [AI Integration](#ai-integration)
- [Editor API](#editor-api)
- [Terminal API](#terminal-api)
- [Debugging API](#debugging-api)
- [Contributing to API](#contributing-to-api)

## Core Interfaces

### Editor

The main editor interface that provides access to the editor's state and allows interaction with the editor.

```typescript
interface Editor {
	// Get the current document
	getDocument(): TextDocument;

	// Get the current selection
	getSelection(): Selection;

	// Set the selection
	setSelection(selection: Selection): Thenable<void>;

	// Execute a command
	executeCommand(command: string, ...args: any[]): Thenable<any>;
}
```

### TextDocument

Represents a text document, such as a source file.

```typescript
interface TextDocument {
	// The URI of the document
	readonly uri: Uri;

	// The file name of the document
	readonly fileName: string;

	// Whether the document is dirty (has unsaved changes)
	readonly isDirty: boolean;

	// Get the text content of the document
	getText(range?: Range): string;

	// Get the number of lines in the document
	readonly lineCount: number;

	// Get a specific line
	lineAt(line: number): TextLine;
}
```

## Extension API

### Registering Commands

```typescript
import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext) {
	// Register a simple command
	const disposable = vscode.commands.registerCommand(
		"extension.sayHello",
		() => {
			vscode.window.showInformationMessage("Hello from MintMind!");
		}
	);

	context.subscriptions.push(disposable);
}
```

### Creating a Custom Editor

```typescript
class CustomDocument implements vscode.CustomDocument {
	constructor(public readonly uri: vscode.Uri) {}

	dispose(): void {
		// Cleanup resources
	}
}

class CustomEditorProvider
	implements vscode.CustomReadonlyEditorProvider<CustomDocument>
{
	openCustomDocument(
		uri: vscode.Uri
	): CustomDocument | Thenable<CustomDocument> {
		return new CustomDocument(uri);
	}

	resolveCustomEditor(
		document: CustomDocument,
		webviewPanel: vscode.WebviewPanel
	): void | Thenable<void> {
		// Set up the webview content
		webviewPanel.webview.html = `<!DOCTYPE html>
      <html>
        <body>
          <h1>Custom Editor</h1>
          <p>Editing: ${document.uri.toString()}</p>
        </body>
      </html>`;
	}
}

// Register the custom editor
context.subscriptions.push(
	vscode.window.registerCustomEditorProvider(
		"custom.editor",
		new CustomEditorProvider(),
		{ webviewOptions: { retainContextWhenHidden: true } }
	)
);
```

## AI Integration

### MCP (Model Context Protocol)

MintMind provides AI capabilities through the Model Context Protocol (MCP). Here's how to use it:

```typescript
// Get the MCP client
const mcpClient = vscode.ai.getMCPClient();

// Send a request to the AI model
const response = await mcpClient.complete({
	prompt: "Explain the following code:",
	code: 'function hello() { return "world"; }',
	maxTokens: 100,
});

// Handle the response
if (response.success) {
	vscode.window.showInformationMessage(response.text);
} else {
	vscode.window.showErrorMessage("Failed to get AI response");
}
```

## Editor API

### Text Editor

```typescript
// Get the active text editor
const editor = vscode.window.activeTextEditor;

if (editor) {
	// Get the document
	const document = editor.document;

	// Get the selection
	const selection = editor.selection;

	// Insert text at the current position
	editor.edit((editBuilder) => {
		editBuilder.insert(selection.active, "Hello, world!");
	});
}
```

### Workspace

```typescript
// Listen for document changes
vscode.workspace.onDidChangeTextDocument((event) => {
	console.log("Document changed:", event.document.uri.toString());
});

// Find files in the workspace
const files = await vscode.workspace.findFiles("**/*.ts");

// Read a file
const content = await vscode.workspace.fs.readFile(uri);
```

## Terminal API

### Creating a Terminal

```typescript
// Create a new terminal
const terminal = vscode.window.createTerminal("My Terminal");

// Show the terminal
terminal.show();

// Send text to the terminal
terminal.sendText("echo Hello, MintMind!");
```

## Debugging API

### Debug Configuration

```typescript
// Start debugging
vscode.debug.startDebugging(undefined, {
	name: "Launch Program",
	type: "node",
	request: "launch",
	program: "${workspaceFolder}/app.js",
});

// Listen for debug session events
vscode.debug.onDidStartDebugSession((session) => {
	console.log("Debug session started:", session.id);
});
```

## Contributing to API

### Adding New API

1. Define the interface in `src/vscode-dts/vscode.d.ts`
2. Implement the functionality in the appropriate service
3. Add tests in the `test/` directory
4. Update this documentation

### Versioning

- Major version changes may include breaking changes
- Minor versions add functionality in a backward-compatible way
- Patch versions include backward-compatible bug fixes

### Deprecation Policy

- Deprecated APIs will be marked with `@deprecated`
- Deprecated APIs will be removed in the next major version
- Migration guides will be provided for breaking changes
