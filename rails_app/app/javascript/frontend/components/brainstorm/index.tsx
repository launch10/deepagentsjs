import type { ChatStatus } from 'ai';
import type { 
    MessageBlock, 
    MessageWithBlocks,
    TextMessageBlock, 
    StructuredMessageBlock, 
    ToolCallMessageBlock,
    ReasoningMessageBlock,
    InferBridgeData
} from 'langgraph-ai-sdk-types';
import type { BrainstormBridgeType } from '@shared';
import React, { createContext, useContext } from 'react';
import ReactMarkdown from 'react-markdown';

export { BrainstormHydrator } from './BrainstormHydrator';

type BrainstormLanggraphData = InferBridgeData<BrainstormBridgeType>;

// Context for handling example clicks and other chat interactions
interface BrainstormContextType {
  onExampleClick?: (text: string) => void;
}

const BrainstormContext = createContext<BrainstormContextType | undefined>(undefined);

export const useBrainstormContext = () => {
  const context = useContext(BrainstormContext);
  if (!context) {
    throw new Error('useBrainstormContext must be used within BrainstormProvider');
  }
  return context;
};

export const BrainstormProvider = ({ 
  children, 
  onExampleClick 
}: { 
  children: React.ReactNode;
  onExampleClick?: (text: string) => void;
}) => {
  return (
    <BrainstormContext.Provider value={{ onExampleClick }}>
      {children}
    </BrainstormContext.Provider>
  );
};

export const Wrapper = (props: {
  children: React.ReactNode;
}) => {
  return (
    <div className="flex flex-col w-full max-w-2xl py-24 mx-auto stretch">
      {props.children}
    </div>
  );
};

const BlockRenderer = ({ block }: { block: MessageBlock<BrainstormLanggraphData> }) => {
  const { onExampleClick } = useBrainstormContext();
  
  switch (block.type) {
    case 'text': {
      const textBlock = block as TextMessageBlock;
      if (!textBlock.text || textBlock.text.trim() === '') {
        return null;
      }
      return (
        <div className="prose prose-sm prose-invert max-w-none">
          <ReactMarkdown>{textBlock.text}</ReactMarkdown>
        </div>
      );
    }
    
    case 'structured': {
      const structuredBlock = block as StructuredMessageBlock<BrainstormLanggraphData>;
      const data = structuredBlock.data;
      
      if (!data || Object.keys(data).length === 0) {
        return null;
      }

      if (data.type === "reply") {
        return (
          <div className="space-y-3">
            {'text' in data && (
              <div className="prose prose-sm prose-invert max-w-none font-medium">
                <ReactMarkdown>{String(data.text)}</ReactMarkdown>
              </div>
            )}
            {'examples' in data && Array.isArray(data.examples) && (
              <div className="space-y-2 mt-3">
                <div className="text-xs font-semibold text-blue-300 mb-2">Sample Answers:</div>
                {data.examples.map((item: any, i: number) => (
                  <div
                    key={i}
                    onClick={() => onExampleClick?.(String(item))}
                    className="w-full text-left p-3 bg-gray-700 rounded-lg border border-gray-500 text-sm cursor-pointer hover:bg-gray-600 transition-colors"
                  >
                    <div className="font-medium text-blue-300 text-xs mb-1">Example {i + 1}:</div>
                    <div>{String(item)}</div>
                  </div>
                ))}
              </div>
            )}
            {'conclusion' in data && (
              <div className="mt-3 pt-3 border-t border-gray-500">
                <div className="prose prose-sm prose-invert max-w-none italic opacity-90">
                  <ReactMarkdown>{String(data.conclusion)}</ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        );
      } else if (data.type === "helpMe") {
        return (
          <div className="space-y-3">
            {'text' in data && (
              <div className="prose prose-sm prose-invert max-w-none font-medium">
                <ReactMarkdown>{String(data.text)}</ReactMarkdown>
              </div>
            )}
            {'examples' in data && Array.isArray(data.examples) && (
              <div className="space-y-2 mt-3">
                <div className="text-xs font-semibold text-blue-300 mb-2">Sample Answers:</div>
                {data.examples.map((item: any, i: number) => (
                  <div
                    key={i}
                    onClick={() => onExampleClick?.(String(item))}
                    className="w-full text-left p-3 bg-gray-700 rounded-lg border border-gray-500 text-sm cursor-pointer hover:bg-gray-600 transition-colors"
                  >
                    <div className="font-medium text-blue-300 text-xs mb-1">Example {i + 1}:</div>
                    <div>{String(item)}</div>
                  </div>
                ))}
              </div>
            )}
            {'template' in data && (
              <div className="mt-3 pt-3 border-t border-gray-500">
                <div className="prose prose-sm prose-invert max-w-none italic opacity-90">
                  <ReactMarkdown>{String(data.template)}</ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        );
      }
      
      return null;
    }
    
    case 'tool_call': {
      const toolBlock = block as ToolCallMessageBlock;
      return (
        <div className="text-xs p-3 bg-gray-700 rounded border border-gray-600">
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-2 h-2 rounded-full ${
              toolBlock.state === 'complete' ? 'bg-green-500' :
              toolBlock.state === 'error' ? 'bg-red-500' :
              'bg-yellow-500'
            }`} />
            <span className="font-semibold">🔧 {toolBlock.toolName}</span>
            <span className="text-gray-400">({toolBlock.state})</span>
          </div>
        </div>
      );
    }
    
    case 'reasoning': {
      const reasoningBlock = block as ReasoningMessageBlock;
      return (
        <div className="text-xs p-3 bg-blue-900/30 rounded border border-blue-700 italic">
          <div className="font-semibold mb-1">💭 Reasoning:</div>
          <div className="opacity-90">{reasoningBlock.text}</div>
        </div>
      );
    }
    
    default:
      return null;
  }
};

export const Message = ({
  message,
  status,
}: {
  message: MessageWithBlocks<BrainstormLanggraphData>;
  status?: ChatStatus;
}) => {
  const isUser = message.role === 'user';
  const hasNoBlocks = message.blocks.length === 0;
  const isLoading = (status === 'submitted' || status === 'streaming') && hasNoBlocks;
  
  return (
    <div className={`flex w-full mb-4 ${
      isUser ? 'justify-end' : 'justify-start'
    }`}>
      <div className={`max-w-[75%] rounded-lg p-4 ${
        isUser
          ? 'bg-blue-800 text-white'
          : 'bg-gray-600 text-white'
      }`}>
        {isLoading ? (
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
            <span className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
            <span className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
          </div>
        ) : (
          <div className="space-y-3">
            {message.blocks.map((block) => (
              <BlockRenderer key={block.id} block={block} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export const ChatInput = ({
  inputRef,
  input,
  onChange,
  onSubmit,
}: {
  inputRef?: React.RefObject<HTMLInputElement | null>;
  input: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
}) => (
  <form onSubmit={onSubmit} className="fixed bottom-0 w-full max-w-2xl mb-8">
    <div className="flex gap-2">
      <input
        ref={inputRef}
        className="flex-1 p-2 border-2 border-zinc-700 rounded shadow-xl bg-gray-800 text-white"
        value={input}
        placeholder="Say something..."
        onChange={onChange}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSubmit(e as any);
          }
        }}
        autoFocus
      />
      <button
        type="submit"
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded shadow-xl font-medium transition-colors"
      >
        Send
      </button>
    </div>
  </form>
);