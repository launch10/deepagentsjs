# Streaming Message Parser Documentation

This document details the functionality of the `StreamingMessageParser` (`app/lib/runtime/message-parser.ts`) and its associated tests (`app/lib/runtime/message-parser.spec.ts`). This parser is a core component responsible for processing text streams (potentially arriving in chunks) from the AI, identifying special command directives (Artifacts and Actions), extracting relevant data, invoking callbacks, and producing cleaned text output.

## Overview

The `StreamingMessageParser` class is designed to handle incoming strings associated with a specific message ID. It maintains internal state for each message to correctly parse content even when it's delivered across multiple chunks.

Its primary functions are:

1.  **Identify Bolt Tags:** Scan the input stream for `<boltArtifact>` and `<boltAction>` tags.
2.  **Extract Data:** Parse attributes from these tags (e.g., `id`, `title`, `type`, `filePath`).
3.  **Manage State:** Track whether the parser is currently inside an artifact or action tag for a given message.
4.  **Invoke Callbacks:** Trigger specific callback functions when opening and closing tags are fully processed.
5.  **Clean Output:** Return the input text with the Bolt tags and their content removed.

## Bolt Tags

The parser recognizes two main XML-like tags:

### 1. `<boltArtifact>`

- **Purpose:** Groups one or more related `<boltAction>` tags. Represents a logical unit of work.
- **Syntax:**
  ```xml
  <boltArtifact title="Description of the artifact" id="unique_artifact_id">
    <!-- Bolt Actions go here -->
  </boltArtifact>
  ```
- **Attributes:**
  - `title` (string): A user-facing description of the artifact.
  - `id` (string): A unique identifier for this artifact instance.
- **Callbacks:**
  - `onArtifactOpen`: Fired when the opening `<boltArtifact ...>` tag (including attributes) is fully parsed.
  - `onArtifactClose`: Fired when the closing `</boltArtifact>` tag is parsed.

### 2. `<boltAction>`

- **Purpose:** Defines a single, specific operation to be performed, such as running a shell command or writing to a file. Must be nested within a `<boltArtifact>`.
- **Syntax:**

  ```xml
  <!-- Example: Shell Action -->
  <boltAction type="shell">npm install react</boltAction>

  <!-- Example: File Action -->
  <boltAction type="file" filePath="src/component.tsx">
  // File content goes here
  const MyComponent = () => <div>Hello!</div>;
  export default MyComponent;
  </boltAction>
  ```

- **Attributes:**
  - `type` (string): The kind of action (e.g., `shell`, `file`).
  - `filePath` (string, optional): Used primarily for `file` actions to specify the target path.
- **Content:** The text content within the `<boltAction>` tags provides the details for the action (e.g., the command to run or the content to write). The parser trims whitespace and adds a trailing newline for `file` actions.
- **Callbacks:**
  - `onActionOpen`: Fired when the opening `<boltAction ...>` tag (including attributes) is fully parsed.
  - `onActionClose`: Fired when the closing `</boltAction>` tag is parsed. The action's content is included in the callback data at this point.

## Parser Logic & State

- **State Management:** The parser uses a `Map` (`#messages`) to store the parsing state for each unique `messageId`. This ensures that if a message arrives in multiple `parse` calls (chunks), the parser remembers where it left off (e.g., if it was inside an artifact tag).
- **Chunk Processing:** The `parse(messageId, input)` method processes the `input` string. It doesn't necessarily parse the entire `input` in one go if it encounters incomplete tags near the end. It updates the internal `position` for the `messageId` and waits for the next chunk.
- **Tag Recognition:** It looks for the specific opening tag patterns (`<boltArtifact`, `<boltAction`) and avoids confusing them with standard HTML or other text.
- **Attribute Extraction:** Helper methods (`#extractAttribute`) pull values from the tag attributes.
- **Output Generation:** The `parse` method returns the portion of the input text that is _not_ part of the Bolt tags.

## Callbacks (`ParserCallbacks`)

The parser's behavior can be hooked into by providing callback functions during instantiation.

```typescript
interface ParserCallbacks {
  onArtifactOpen?: (data: ArtifactCallbackData) => void;
  onArtifactClose?: (data: ArtifactCallbackData) => void;
  onActionOpen?: (data: ActionCallbackData) => void;
  onActionClose?: (data: ActionCallbackData) => void;
}

// Data interfaces contain messageId, artifactId, actionId (for actions),
// and the parsed artifact/action data.
```

These callbacks allow external systems (like the `ActionRunner`) to react immediately when artifacts and actions are defined in the stream.

## Configuration (`StreamingMessageParserOptions`)

When creating a `StreamingMessageParser` instance, you can pass options:

```typescript
interface StreamingMessageParserOptions {
  callbacks?: ParserCallbacks;
  artifactElement?: (props: { messageId: string }) => string;
}
```

- `callbacks`: An object containing the callback functions described above.
- `artifactElement`: A function to generate a placeholder element in the output stream where an artifact was parsed. By default (`createArtifactElement`), it creates an empty `<span data-artifact-id="..."></span>`. This can be overridden or disabled (as done in tests).

## Testing (`message-parser.spec.ts`)

The test suite (`message-parser.spec.ts`) provides comprehensive coverage for the parser:

- **Framework:** Uses `vitest`.
- **Methodology:**
  - Employs `describe` blocks to group tests by scenario (e.g., no artifacts, invalid tags, valid artifacts with/without actions).
  - Uses `it.each` for parameterized tests, running the same logic against various input strings and chunking patterns.
  - Mocks callbacks using `vi.fn`.
  - Asserts the final cleaned output string.
  - Verifies that callbacks were called the correct number of times (`toHaveBeenCalledTimes`) and with the expected data using `toMatchSnapshot`.
- **Key Scenarios Tested:**
  - Passthrough of plain text and standard HTML.
  - Correct identification and stripping of valid Bolt tags.
  - Handling of incomplete tags arriving across multiple chunks.
  - Ignoring malformed or incorrect Bolt tags.
  - Correct invocation and payload data for all callbacks.
  - Parsing of different action types (`shell`, `file`) and their attributes.

### Running & Debugging Tests

**Running Tests:**

- **Run all tests once:**
  ```bash
  pnpm test
  ```
- **Run specific file tests:**
  ```bash
  # Replace <path_to_spec_file> with the actual path
  pnpm test -- <path_to_spec_file>
  # Example:
  pnpm test -- app/lib/runtime/message-parser.spec.ts
  ```
- **Run tests in watch mode:** (Automatically re-runs on changes)
  ```bash
  pnpm test:watch
  ```

**Focusing on Specific Tests:**

1. **Watch a specific test file:**

   ```bash
   pnpm test:watch app/lib/runtime/message-parser.spec.ts
   ```

2. **Focus on specific test cases:**

   - Add `.only` to any `describe` or `it` block to run only those tests:

     ```typescript
     // Only run this describe block
     describe.only('valid gen-code with gen-write', () => {
       // tests...
     });

     // Or only run this specific test
     it.only('should handle specific case', () => {
       // test...
     });
     ```

   - You can have multiple `.only` calls to run a subset of tests
   - Remove `.only` when done to run all tests again

3. **Filter tests in watch mode:**
   - Press `t` to filter by test name pattern
   - Press `f` to filter by filename pattern
   - Press `a` to run all tests again

**Debugging Tests:**

There are two main ways to debug tests:

1. **Using Node Inspector:**

   ```bash
   # Start test with debugger
   node --inspect-brk node_modules/.bin/vitest app/lib/runtime/message-parser.spec.ts

   # Then open Chrome and navigate to chrome://inspect
   # Click "Open dedicated DevTools for Node"
   ```

2. **Using IDE Debugger (Recommended):**
   - In VS Code or Windsurf:
     1. Click the "Run and Debug" sidebar icon (or press Cmd+Shift+D)
     2. Create a launch configuration for Vitest:
        ```json
        {
          "version": "0.2.0",
          "configurations": [
            {
              "type": "node",
              "request": "launch",
              "name": "Debug Current Test File",
              "autoAttachChildProcesses": true,
              "skipFiles": ["<node_internals>/**", "**/node_modules/**"],
              "program": "${workspaceRoot}/node_modules/vitest/vitest.mjs",
              "args": ["run", "${relativeFile}"],
              "smartStep": true,
              "console": "integratedTerminal"
            }
          ]
        }
        ```
     3. Set breakpoints in your test file (or use `debugger;` statements)
     4. Select "Debug Current Test File" from the Run/Debug dropdown
     5. Press F5 or click the green play button

The `debugger;` statements will only pause execution when running in debug mode through one of these methods. They won't pause when running tests normally with `pnpm test` or `pnpm test:watch`.

**Using the Debugger:**

When execution pauses at a breakpoint:

1. **Debug Console:**

   - Open the Debug Console panel (View > Debug Console or Cmd+Shift+Y)
   - Type expressions to evaluate them in the current context
   - Access variables that are in scope
   - Example: Type `parser` to inspect the StreamingMessageParser instance

2. **Debug Controls:** (Top of editor)

   - Continue (F5): Resume execution
   - Step Over (F10): Execute current line
   - Step Into (F11): Step into function calls
   - Step Out (Shift+F11): Complete current function
   - Restart (Shift+Cmd+F5): Restart debugging
   - Stop (Shift+F5): End debugging session

3. **Debug Sidebar:** (Left panel when debugging)

   - Variables: View all variables in scope
   - Watch: Add expressions to monitor
   - Call Stack: See the execution path
   - Breakpoints: Manage all breakpoints

4. **Common Debug Console Commands:**

   ```javascript
   // Inspect variables
   parser;
   parser.#messages; // View private field (might need public getter)

   // Test expressions
   parser.parse('test_id', 'some text');

   // Access test context
   input;
   expected;

   // Console methods work too
   console.log(parser);
   console.dir(parser, { depth: null });
   ```

5. **Adding Watches:**
   - In the Debug sidebar, click the '+' in the Watch section
   - Enter expressions to monitor continuously
   - Example: `parser.#messages.size`
