import { describe, expect, it, vi } from "vitest";
import {
  StreamingMessageParser,
  type CodeCallback,
  type WriteCallback,
  type DependencyCallback,
  type RenameCallback,
  type DeleteCallback,
} from "~/lib/runtime/message-parser";

interface ExpectedResult {
  output: string;
  callbacks?: {
    onCodeOpen?: number;
    onCodeClose?: number;
    onWriteOpen?: number;
    onWriteClose?: number;
    onDependencyOpen?: number;
    onDependencyClose?: number;
    onRenameOpen?: number;
    onRenameClose?: number;
    onDeleteOpen?: number;
    onDeleteClose?: number;
  };
  expectedCallbackData?: {
    onCodeOpen?: any[];
    onCodeClose?: any[];
    onWriteOpen?: any[];
    onWriteClose?: any[];
    onDependencyOpen?: any[];
    onDependencyClose?: any[];
    onRenameOpen?: any[];
    onRenameClose?: any[];
    onDeleteOpen?: any[];
    onDeleteClose?: any[];
  };
}

const easyParse = `
Here is the code:
<gen-code artifactId="example-code-snippet">
  <gen-write filePath="index.html">
    <p>Some content</p>
  </gen-write>
  <gen-add-dependency name="react" version="^18.2.0"></gen-add-dependency>
  <gen-write filePath="src/components/MyComponent.tsx">
    <p>Here is the component</p>
  </gen-write>
</gen-code>
`;

const longFileContent = `
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';

// ... keep existing code (import statements)

function UserProfile({ user }) {
  // ... keep existing code (state variables and helper functions)
  
  return (
    <div className="user-profile-container">
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <div className="flex items-center gap-4">
            <Avatar>
              <img src={user.avatar} alt={user.name} />
            </Avatar>
            <CardTitle>{user.name}</CardTitle>
          </div>
        </CardHeader>
        
        {/* ... keep existing code (user details section) */}
        
        {/* New preferences section */}
        <CardContent>
          <h3 className="text-lg font-semibold mb-2">Preferences</h3>
          <div className="space-y-2">
            {user.preferences.map((pref, index) => (
              <div key={index} className="flex justify-between">
                <span className="text-gray-700">{pref.name}</span>
                <span className="font-medium">{pref.value}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ... keep existing code (export statement and prop types)
`;

const parseWithKeepExistingCode = `
<gen-code artifactId="user-profile-page">
I'll update the UserProfile.jsx file to add a new section for displaying user preferences while keeping the existing functionality intact.

<gen-write filePath="src/components/UserProfile.jsx">${longFileContent}</gen-write>
</gen-code>

I've added a new preferences section to the user profile card that displays each of the user's preferences in a clean, organized format.
`;

const parseWithFileActions = `
I'll update the UserProfile.jsx file to add a new section for displaying user preferences while keeping the existing functionality intact.
<gen-code artifactId="user-profile-page">
<gen-write filePath="src/components/UserProfileNew.tsx"><p>Some content</p></gen-write>
<gen-delete filePath="src/components/UserProfileOld.tsx"></gen-delete>
<gen-rename filePath="src/components/UserProfile.tsx" newPath="src/components/UserProfileAncient.tsx"></gen-rename>
<gen-add-dependency name="react" version="^18.2.0"></gen-add-dependency>
</gen-code>
I've added a new preferences section to the user profile card that displays each of the user's preferences in a clean, organized format.
`;

const parseWithoutClosingTags = `
I'll update the UserProfile.jsx file to add a new section for displaying user preferences while keeping the existing functionality intact.
<gen-code artifactId="user-profile-page">
  <gen-add-dependency name="react" version="^18.2.0" />
</gen-code>
I've added a new preferences section to the user profile card that displays each of the user's preferences in a clean, organized format.
`;

describe("StreamingMessageParser", () => {
  it("should pass through normal text", () => {
    const parser = new StreamingMessageParser();
    expect(parser.parse("test_id", "Hello, world!")).toBe("Hello, world!");
  });

  it("should allow normal HTML tags", () => {
    const parser = new StreamingMessageParser();
    expect(parser.parse("test_id", "Hello <strong>world</strong>!")).toBe(
      "Hello <strong>world</strong>!"
    );
  });

  describe("no artifacts", () => {
    it.each<[string | string[], ExpectedResult | string]>([
      ["Foo bar", "Foo bar"],
      ["Foo bar <", "Foo bar "],
      ["Foo bar <p", "Foo bar <p"],
      [
        ["Foo bar <", "Foo bar <s", "Foo bar <sp", "Foo bar <span>some text</span>"],
        "Foo bar <span>some text</span>",
      ],
    ])("should correctly parse chunks and strip out bolt artifacts (%#)", (input, expected) => {
      runTest(input, expected);
    });
  });

  describe("invalid or incomplete artifacts", () => {
    it.each<[string | string[], ExpectedResult | string]>([
      // ['Foo bar <l', 'Foo bar '],
      [
        "Foo bar <gen-code>",
        {
          output: "Foo bar ",
          callbacks: { onCodeOpen: 1 },
        },
      ],
      ["Foo bar <la", "Foo bar <la"],
      ["Foo bar <gen", "Foo bar "],
      ["Foo bar <gen-c", "Foo bar "],
      ["Foo bar <gen-co", "Foo bar "],
      ["Foo bar <gen-cod", "Foo bar "],
      ["Foo bar <gen-coode></love-code>", "Foo bar <gen-coode></love-code>"],
      ["Before <love-code>foo</love-code> After", "Before <love-code>foo</love-code> After"],
      [
        "Before <boltArtifactt>foo</boltArtifact> After",
        "Before <boltArtifactt>foo</boltArtifact> After",
      ],
    ])("should correctly parse chunks and strip out bolt artifacts (%#)", (input, expected) => {
      runTest(input, expected);
    });
  });

  describe("valid artifacts without actions", () => {
    it.each<[string | string[], ExpectedResult | string]>([
      [
        easyParse,
        {
          output: "\nHere is the code:\n\n",
          expectedCallbackData: {
            onCodeOpen: [
              expect.objectContaining({
                messageId: "message_1",
                artifactId: "example-code-snippet",
              }),
            ],
            onCodeClose: [
              expect.objectContaining({
                messageId: "message_1",
                artifactId: "example-code-snippet",
              }),
            ],
            onWriteOpen: [
              expect.objectContaining({
                messageId: "message_1",
                artifactId: "example-code-snippet",
                actionId: "1",
              }),
              expect.objectContaining({
                messageId: "message_1",
                artifactId: "example-code-snippet",
                actionId: "3",
              }),
            ],
            onWriteClose: [
              expect.objectContaining({
                messageId: "message_1",
                artifactId: "example-code-snippet",
                actionId: "1",
                action: expect.objectContaining({
                  filePath: "index.html",
                  content: expect.stringContaining("<p>Some content</p>"),
                }),
              }),
              expect.objectContaining({
                messageId: "message_1",
                artifactId: "example-code-snippet",
                actionId: "3",
                action: expect.objectContaining({
                  filePath: "src/components/MyComponent.tsx",
                  content: expect.stringContaining("<p>Here is the component</p>"),
                }),
              }),
            ],
            onDependencyOpen: [
              expect.objectContaining({
                messageId: "message_1",
                artifactId: "example-code-snippet",
                actionId: "2",
              }),
            ],
            onDependencyClose: [
              expect.objectContaining({
                messageId: "message_1",
                artifactId: "example-code-snippet",
                actionId: "2",
                action: expect.objectContaining({
                  name: "react",
                  version: "^18.2.0",
                }),
              }),
            ],
          },
        },
      ],
      [
        [
          'Some text before <gen-code artifactId="example-code-snippet">',
          'Some text before <gen-code artifactId="example-code-snippet">',
          'Some text before <gen-code artifactId="example-code-snippet"><gen-write',
          'Some text before <gen-code artifactId="example-code-snippet"><gen-write filePath="src/components/MyComponent.tsx">',
          'Some text before <gen-code artifactId="example-code-snippet"><gen-write filePath="src/components/MyComponent.tsx">// component body</gen-write>',
          'Some text before <gen-code artifactId="example-code-snippet"><gen-write filePath="src/components/MyComponent.tsx">// component body</gen-write><gen-add',
          'Some text before <gen-code artifactId="example-code-snippet"><gen-write filePath="src/components/MyComponent.tsx">// component body</gen-write><gen-add-dependency name="react" version="^18.2.0">',
          'Some text before <gen-code artifactId="example-code-snippet"><gen-write filePath="src/components/MyComponent.tsx">// component body</gen-write><gen-add-dependency name="react" version="^18.2.0"></gen-add-dependency>',
          'Some text before <gen-code artifactId="example-code-snippet"><gen-write filePath="src/components/MyComponent.tsx">// component body</gen-write><gen-add-dependency name="react" version="^18.2.0"></gen-add-dependency></gen-code> Some more text',
        ],
        {
          output: "Some text before  Some more text",
          expectedCallbackData: {
            onCodeOpen: [
              expect.objectContaining({
                messageId: "message_1",
                artifactId: "example-code-snippet",
              }),
            ],
            onWriteClose: [
              expect.objectContaining({
                messageId: "message_1",
                artifactId: "example-code-snippet",
                action: expect.objectContaining({
                  filePath: "src/components/MyComponent.tsx",
                  content: "// component body",
                }),
              }),
            ],
            onDependencyClose: [
              expect.objectContaining({
                messageId: "message_1",
                artifactId: "example-code-snippet",
                action: expect.objectContaining({
                  name: "react",
                  version: "^18.2.0",
                }),
              }),
            ],
            onCodeClose: [
              expect.objectContaining({
                messageId: "message_1",
                artifactId: "example-code-snippet",
              }),
            ],
          },
        },
      ],
      [
        [
          "Some text before <gen-code",
          'Some text before <gen-code artifactId="example-code',
          'Some text before <gen-code artifactId="example-code-snippet"><gen-write filePath="src/components/MyComponent.tsx">',
          'Some text before <gen-code artifactId="example-code-snippet"><gen-write filePath="src/components/MyComponent.tsx">foo</gen-write></gen-code> Some more text',
        ],
        {
          output: "Some text before  Some more text",
          expectedCallbackData: {
            onCodeOpen: [
              expect.objectContaining({
                messageId: "message_1",
                artifactId: "example-code-snippet",
              }),
            ],
            onWriteClose: [
              expect.objectContaining({
                messageId: "message_1",
                artifactId: "example-code-snippet",
                action: expect.objectContaining({
                  filePath: "src/components/MyComponent.tsx",
                  content: "foo",
                }),
              }),
            ],
            onCodeClose: [
              expect.objectContaining({
                messageId: "message_1",
                artifactId: "example-code-snippet",
              }),
            ],
          },
        },
      ],
      [
        [parseWithFileActions],
        {
          output: `I'll update the UserProfile.jsx file to add a new section for displaying user preferences while keeping the existing functionality intact.\n\nI've added a new preferences section to the user profile card that displays each of the user's preferences in a clean, organized format.`,
          expectedCallbackData: {
            onCodeOpen: [
              expect.objectContaining({
                messageId: "message_1",
                artifactId: "user-profile-page",
              }),
            ],
            onWriteClose: [
              expect.objectContaining({
                messageId: "message_1",
                artifactId: "user-profile-page",
                action: expect.objectContaining({
                  filePath: "src/components/UserProfileNew.tsx",
                  content: `<p>Some content</p>`,
                }),
              }),
            ],
            onRenameClose: [
              expect.objectContaining({
                messageId: "message_1",
                artifactId: "user-profile-page",
                action: expect.objectContaining({
                  filePath: "src/components/UserProfile.tsx",
                  newPath: "src/components/UserProfileAncient.tsx",
                }),
              }),
            ],
            onDeleteClose: [
              expect.objectContaining({
                messageId: "message_1",
                artifactId: "user-profile-page",
                action: expect.objectContaining({
                  filePath: "src/components/UserProfileOld.tsx",
                }),
              }),
            ],
            onDependencyClose: [
              expect.objectContaining({
                messageId: "message_1",
                artifactId: "user-profile-page",
                action: expect.objectContaining({
                  name: "react",
                  version: "^18.2.0",
                }),
              }),
            ],
            onCodeClose: [
              expect.objectContaining({
                messageId: "message_1",
                artifactId: "user-profile-page",
              }),
            ],
          },
        },
      ],
      [
        [parseWithKeepExistingCode],
        {
          output: "",
          expectedCallbackData: {
            onCodeOpen: [
              expect.objectContaining({
                messageId: "message_1",
              }),
            ],
            onWriteClose: [
              expect.objectContaining({
                messageId: "message_1",
                action: expect.objectContaining({
                  filePath: "src/components/UserProfile.jsx",
                  content: longFileContent.trim(),
                }),
              }),
            ],
            onCodeClose: [
              expect.objectContaining({
                messageId: "message_1",
              }),
            ],
          },
        },
      ],
      [
        [parseWithoutClosingTags],
        {
          output: "",
          expectedCallbackData: {
            onDependencyClose: [
              expect.objectContaining({
                messageId: "message_1",
                artifactId: "user-profile-page",
                action: expect.objectContaining({
                  name: "react",
                  version: "^18.2.0",
                }),
              }),
            ],
          },
        },
      ],
    ])("should correctly parse chunks and strip out bolt artifacts (%#)", (input, expected) => {
      runTest(input, expected);
    });
  });

  describe("valid artifacts with actions", () => {
    it.each<[string | string[], ExpectedResult | string]>([
      [
        'Before <gen-code><gen-write filePath="index.js">console.log("Hello world")</gen-write></gen-code> After',
        {
          output: "Before  After",
          callbacks: { onCodeOpen: 1, onCodeClose: 1, onWriteOpen: 0, onWriteClose: 1 },
          expectedCallbackData: {
            onWriteClose: [
              expect.objectContaining({
                messageId: "message_1",
                action: expect.objectContaining({
                  filePath: "index.js",
                  content: 'console.log("Hello world")',
                }),
              }),
            ],
          },
        },
      ],
      [
        'Before <gen-code><gen-write filePath="index.js">console.log("Hello world")</gen-write><gen-add-dependency name="lodash" version="^4.17.21"></gen-add-dependency></gen-code> After',
        {
          output: "Before  After",
          callbacks: {
            onCodeOpen: 1,
            onCodeClose: 1,
            onWriteOpen: 0,
            onWriteClose: 1,
            onDependencyOpen: 0,
            onDependencyClose: 1,
          },
          expectedCallbackData: {
            onWriteClose: [
              expect.objectContaining({
                messageId: "message_1",
                action: expect.objectContaining({
                  filePath: "index.js",
                  content: 'console.log("Hello world")',
                }),
              }),
            ],
            onDependencyClose: [
              expect.objectContaining({
                messageId: "message_1",
                action: expect.objectContaining({
                  name: "lodash",
                  version: "^4.17.21",
                }),
              }),
            ],
          },
        },
      ],
    ])("should correctly parse chunks and strip out bolt artifacts (%#)", (input, expected) => {
      runTest(input, expected);
    });
  });
});

function runTest(input: string | string[], outputOrExpectedResult: string | ExpectedResult) {
  let expected: ExpectedResult;

  if (typeof outputOrExpectedResult === "string") {
    expected = { output: outputOrExpectedResult };
  } else {
    expected = outputOrExpectedResult;
  }

  const callbacks = {
    onCodeOpen: vi.fn<CodeCallback>(),
    onCodeClose: vi.fn<CodeCallback>(),
    onWriteOpen: vi.fn<WriteCallback>(),
    onWriteClose: vi.fn<WriteCallback>(),
    onDependencyOpen: vi.fn<DependencyCallback>(),
    onDependencyClose: vi.fn<DependencyCallback>(),
    onRenameOpen: vi.fn<RenameCallback>(),
    onRenameClose: vi.fn<RenameCallback>(),
    onDeleteOpen: vi.fn<DeleteCallback>(),
    onDeleteClose: vi.fn<DeleteCallback>(),
  };

  const parser = new StreamingMessageParser({
    artifactElement: () => "",
    callbacks,
  });

  const chunks = Array.isArray(input) ? input : [input];
  let result = "";

  // Process each chunk individually
  for (const chunk of chunks) {
    result += parser.parse("message_1", chunk);
  }

  for (const name in expected.expectedCallbackData) {
    const callbackName = name as keyof typeof expected.expectedCallbackData;
    const expectedData = expected.expectedCallbackData[callbackName];
    if (expectedData) {
      expect(callbacks[callbackName]).toHaveBeenCalledTimes(expectedData.length);
      expectedData.forEach((data, index) => {
        expect(callbacks[callbackName]).toHaveBeenNthCalledWith(index + 1, data);
      });
    }
  }

  if (expected.output.length > 0) {
    expect(result.trim()).toEqual(expected.output.trim());
  }
}
