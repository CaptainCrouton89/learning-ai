# AI SDK Streaming and Tool Calling Reference

## Overview

The Vercel AI SDK provides powerful streaming capabilities for both text generation and tool calling. This reference covers implementation patterns for streaming responses with and without tool calls.

## Basic Streaming

### Server-Side (API Route)

```typescript
import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: openai('gpt-4o'),
    messages,
  });

  return result.toUIMessageStreamResponse();
}
```

### Client-Side (React)

```typescript
import { useChat } from '@ai-sdk/react';

export default function Chat() {
  const { messages, sendMessage } = useChat({
    api: '/api/chat'
  });
  
  // Messages stream automatically as they're generated
}
```

## Tool Calling with Streaming

### Key Concepts

1. **Tool Call Streaming**: Enabled by default in AI SDK v5
2. **Multi-Step Execution**: Use `stopWhen: stepCountIs(n)` to allow multiple tool calls
3. **Stream States**: Tool calls progress through states: `input-streaming` → `input-available` → `output-available`

### Server-Side Tool Definition

```typescript
import { openai } from '@ai-sdk/openai';
import { streamText, tool, stepCountIs } from 'ai';
import { z } from 'zod';

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: openai('gpt-4o'),
    messages: convertToModelMessages(messages),
    
    // Enable multi-step tool calls (up to 5 steps)
    stopWhen: stepCountIs(5),
    
    tools: {
      // Server-executed tool (has execute function)
      getWeather: tool({
        description: 'Get weather for a location',
        inputSchema: z.object({
          city: z.string(),
          unit: z.enum(['C', 'F'])
        }),
        execute: async ({ city, unit }) => {
          // Tool executes on server
          const weather = await fetchWeather(city);
          return `${weather.temp}°${unit} in ${city}`;
        }
      }),
      
      // Client-side tool (no execute function)
      getUserLocation: tool({
        description: 'Get user location',
        inputSchema: z.object({}),
        // No execute - handled on client
      })
    },
    
    // Callbacks for monitoring
    onStepFinish: ({ toolCalls, toolResults }) => {
      console.log('Step completed:', { toolCalls, toolResults });
    },
    
    onFinish: ({ usage, isAborted }) => {
      if (isAborted) {
        console.log('Stream aborted');
      }
      console.log('Token usage:', usage);
    }
  });

  return result.toUIMessageStreamResponse();
}
```

### Client-Side Tool Handling

```typescript
'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';

export default function Chat() {
  const { messages, sendMessage, addToolResult } = useChat({
    transport: new DefaultChatTransport({ api: '/api/chat' }),
    
    // Handle client-side tools
    onToolCall: async ({ toolCall }) => {
      if (toolCall.toolName === 'getUserLocation') {
        const location = await navigator.geolocation.getCurrentPosition();
        
        // Provide tool result back to conversation
        addToolResult({
          tool: 'getUserLocation',
          toolCallId: toolCall.toolCallId,
          output: { lat: location.coords.latitude, lon: location.coords.longitude }
        });
      }
    }
  });
  
  return (
    <div>
      {messages.map(message => (
        <div key={message.id}>
          {message.parts.map(part => {
            switch (part.type) {
              case 'text':
                return <span>{part.text}</span>;
                
              case 'tool-getWeather':
                // Render tool states
                switch (part.state) {
                  case 'input-streaming':
                    return <pre>Loading: {JSON.stringify(part.input)}</pre>;
                  case 'input-available':
                    return <pre>Calling: {JSON.stringify(part.input)}</pre>;
                  case 'output-available':
                    return <pre>Result: {JSON.stringify(part.output)}</pre>;
                  case 'output-error':
                    return <div>Error: {part.errorText}</div>;
                }
            }
          })}
        </div>
      ))}
    </div>
  );
}
```

## Streaming Tool Results

### AsyncIterable Pattern for Progressive Updates

```typescript
tool({
  description: 'Long-running operation',
  inputSchema: z.object({ query: z.string() }),
  async *execute({ query }) {
    // Stream intermediate updates
    yield { status: 'loading', text: 'Starting search...' };
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    yield { status: 'processing', text: 'Processing results...' };
    
    const results = await performSearch(query);
    
    // Final yield becomes the tool result
    yield { status: 'complete', results };
  }
})
```

## Advanced Patterns

### Reading UI Message Streams

```typescript
import { readUIMessageStream } from 'ai';

for await (const uiMessage of readUIMessageStream({ stream })) {
  uiMessage.parts.forEach(part => {
    switch (part.type) {
      case 'text':
        console.log('Text:', part.text);
        break;
      case 'tool-call':
        console.log('Tool called:', part.toolName, part.args);
        break;
      case 'tool-result':
        console.log('Tool result:', part.result);
        break;
    }
  });
}
```

### Custom Stream Processing

```typescript
import { createUIMessageStream, createUIMessageStreamResponse } from 'ai';

export async function POST(req: Request) {
  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      const result = streamText({
        model: openai('gpt-4o'),
        messages,
        tools: {
          myTool: tool({
            execute: async (args, { toolCallId }) => {
              // Write custom status updates
              writer.write({
                type: 'data-tool-status',
                id: toolCallId,
                data: { status: 'in-progress' }
              });
              
              const result = await processTask(args);
              return result;
            }
          })
        }
      });
      
      writer.merge(result.toUIMessageStream());
    }
  });
  
  return createUIMessageStreamResponse({ stream });
}
```

### Handling Stream Abortion

```typescript
import { consumeStream } from 'ai';

export async function POST(req: Request) {
  const result = streamText({
    model: openai('gpt-4o'),
    messages,
    abortSignal: req.signal,
  });

  return result.toUIMessageStreamResponse({
    onFinish: async ({ isAborted }) => {
      if (isAborted) {
        // Cleanup on abort
        console.log('Stream was aborted');
      }
    },
    // Ensure onFinish is called even on abort
    consumeSseStream: consumeStream,
  });
}
```

## Stream Protocol Events

The AI SDK uses Server-Sent Events (SSE) for streaming. Key event types:

### Tool-Related Events

- `tool-input-start`: Tool call initiated
- `tool-input-delta`: Incremental input chunks
- `tool-input-available`: Complete input ready
- `tool-output-available`: Tool execution complete
- `tool-output-error`: Tool execution failed

### Example SSE Sequence

```
data: {"type":"tool-input-start","toolCallId":"call_123","toolName":"getWeather"}
data: {"type":"tool-input-delta","toolCallId":"call_123","inputTextDelta":"San Francisco"}
data: {"type":"tool-input-available","toolCallId":"call_123","input":{"city":"San Francisco"}}
data: {"type":"tool-output-available","toolCallId":"call_123","output":{"temp":72,"weather":"sunny"}}
```

## Best Practices

### 1. Enable Multi-Step Tool Calls

```typescript
streamText({
  // Allow up to 5 steps for complex interactions
  stopWhen: stepCountIs(5),
  // Model can call tools and then use results in response
})
```

### 2. Type-Safe Tool Definitions

```typescript
import { InferUITools, ToolSet, UIMessage } from 'ai';

const tools = {
  weather: weatherTool,
  location: locationTool
} satisfies ToolSet;

// Infer types for client
export type ChatTools = InferUITools<typeof tools>;
export type ChatMessage = UIMessage<never, UIDataTypes, ChatTools>;
```

### 3. Parallel Tool Execution

```typescript
// Tools execute in parallel when called together
const toolPromises = toolCalls.map(async toolCall => {
  const result = await executeToolCall(toolCall);
  return {
    role: 'tool' as const,
    content: [{
      type: 'tool-result' as const,
      toolCallId: toolCall.toolCallId,
      toolName: toolCall.toolName,
      output: result
    }]
  };
});

const toolResults = await Promise.all(toolPromises);
```

### 4. Error Handling

```typescript
result.toUIMessageStreamResponse({
  onError: error => {
    if (NoSuchToolError.isInstance(error)) {
      return 'Unknown tool requested';
    }
    if (InvalidToolInputError.isInstance(error)) {
      return 'Invalid tool input provided';
    }
    return 'An error occurred';
  }
});
```

### 5. Resource Cleanup

```typescript
// For streaming responses
streamText({
  onFinish: async () => {
    await cleanup();
  }
});

// For non-streaming with external resources
let client;
try {
  client = await createClient();
  // Use client
} finally {
  await client?.close();
}
```

## Migration Notes

### From v4 to v5

- Tool call streaming is enabled by default
- `toolCallStreaming` parameter is deprecated
- Use `stopWhen` instead of `maxSteps`
- `onStepFinish` replaces `onToolCall` for monitoring

### Key Differences from Standard Streaming

1. Tool calls add intermediate states before final output
2. Multi-step execution requires explicit `stopWhen` configuration  
3. Client-side tools need manual result provision via `addToolResult`
4. Server-side tools with `execute` run automatically

## Common Patterns

### Human-in-the-Loop Confirmation

```typescript
// Server: Define tool without execute
tools: {
  deleteFile: tool({
    description: 'Delete a file (requires confirmation)',
    inputSchema: z.object({ path: z.string() }),
    // No execute - handled on client
  })
}

// Client: Handle confirmation
onToolCall: async ({ toolCall }) => {
  if (toolCall.toolName === 'deleteFile') {
    const confirmed = await getUserConfirmation();
    if (confirmed) {
      await deleteFile(toolCall.input.path);
      addToolResult({ 
        tool: 'deleteFile',
        toolCallId: toolCall.toolCallId,
        output: 'File deleted'
      });
    }
  }
}
```

### Progressive Enhancement

```typescript
// Start with loading state, enhance with results
async *execute({ query }) {
  yield <LoadingComponent />;
  const data = await fetchData(query);
  yield <DataComponent data={data} />;
  const enhanced = await enhanceData(data);
  return <EnhancedComponent data={enhanced} />;
}
```

## Debugging Tips

1. Use `onStepFinish` to log tool execution flow
2. Monitor SSE events in browser DevTools Network tab
3. Check `part.state` for tool execution status
4. Use `onChunk` callback for low-level stream debugging
5. Enable verbose logging with environment variables

## References

- [AI SDK Core Documentation](https://sdk.vercel.ai/docs)
- [Streaming Protocol Specification](https://sdk.vercel.ai/docs/ai-sdk-ui/stream-protocol)
- [Tool Calling Guide](https://sdk.vercel.ai/docs/ai-sdk-core/tools-and-tool-calling)
- [Migration Guide](https://sdk.vercel.ai/docs/migrating)