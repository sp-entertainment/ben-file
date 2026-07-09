# Ben File

Ben File adds syntax highlighting and snippets for `.ben` task files.

## Features

- Highlights section headings, notes, task states (`X`, `O`, `W`, `T`, `-`), URLs, and parenthesized metadata.
- Supports nested task lists and indented headings.
- Adds snippets for common task lines and subtasks.

## Usage

1. Open any `.ben` file in VS Code.
2. Use snippet prefixes such as `ben-x`, `ben-o`, `ben-w`, `ben-t`, `ben-task`, or `ben-sub`.
3. Write metadata inline in parentheses, for example `- File taxes(due Friday)`.

## Example

```text
WORKING QUEUE
O - Create TODO app
	T - Review on Friday(due 07/11)
	- Share prototype with friends
Reference: https://example.com
```

## Requirements

- Visual Studio Code **1.75** or newer.

## Extension Settings

This extension does not contribute workspace settings.

## Release Notes

### 0.0.1

Initial syntax highlighting and snippet support for `.ben` files.
