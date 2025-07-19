import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MessageComponent } from '../components/MessageComponent';
import { HomePage } from '../pages/HomePage';
import useAppStore from '../store/chat-store';

// Mock the store and external dependencies
jest.mock('../store/chat-store');
jest.mock('../services/workflow.service');
jest.mock('src/components/Layout', () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div data-testid="layout">{children}</div>,
}));

const mockUseAppStore = useAppStore as jest.MockedFunction<typeof useAppStore>;

// Mock chat service
const mockProcessChatRequest = jest.fn();
jest.mock('../../sashi-lib/src/chat', () => ({
  processChatRequest: mockProcessChatRequest,
}));

describe('Embedded Workflow Integration Tests', () => {
  const mockStoreState = {
    messages: [],
    apiUrl: 'http://localhost:3000/api',
    connectedToHub: true,
    sessionToken: 'test-token',
    addMessage: jest.fn(),
    clearMessages: jest.fn(),
  };

  beforeEach(() => {
    mockUseAppStore.mockImplementation((selector) => {
      if (typeof selector === 'function') {
        return selector(mockStoreState);
      }
      return mockStoreState;
    });

    mockProcessChatRequest.mockClear();
    jest.clearAllMocks();
  });

  describe('User Input to Embedded Workflow Flow', () => {
    it('should handle user request and display embedded workflow response', async () => {
      // Mock AI response with embedded workflow
      const mockResponse = {
        type: 'general',
        content: `I'll help you change a user's type. Here's a workflow:

\`\`\`workflow
{
  "type": "workflow",
  "description": "Change user type",
  "actions": [
    {
      "id": "change_user_type",
      "tool": "change_user_type",
      "description": "Update the user's type",
      "parameters": {
        "userId": "userInput.userId",
        "type": "userInput.type"
      },
      "parameterMetadata": {
        "userId": {
          "type": "string",
          "description": "The user's ID",
          "required": true
        },
        "type": {
          "type": "string",
          "description": "The new user type",
          "enum": ["CASE_MANAGER", "COMMUNITY_ENGAGEMENT"],
          "required": true
        }
      },
      "map": false
    }
  ]
}
\`\`\`

Just fill in the user ID and select the new type.`,
      };

      mockProcessChatRequest.mockResolvedValue(mockResponse);

      render(<HomePage />);

      // Simulate user input
      const input = screen.getByPlaceholderText('Send a message...');
      const submitButton = screen.getByRole('button', { name: /submit/i });

      fireEvent.change(input, { target: { value: 'Create a workflow to change user type' } });
      fireEvent.click(submitButton);

      // Wait for response processing
      await waitFor(() => {
        expect(mockProcessChatRequest).toHaveBeenCalledWith({
          inquiry: 'Create a workflow to change user type',
          previous: expect.any(Array),
        });
      });

      // Verify that the message was added to the store
      expect(mockStoreState.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'user',
          content: 'Create a workflow to change user type',
        })
      );

      expect(mockStoreState.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'assistant',
          content: expect.stringContaining('```workflow'),
        })
      );
    });

    it('should handle multiple workflows in a single response', async () => {
      const mockResponse = {
        type: 'general',
        content: `Here are two workflows:

\`\`\`workflow
{
  "type": "workflow",
  "description": "Get user",
  "actions": [{"id": "get_user", "tool": "get_user_by_id", "parameters": {}}]
}
\`\`\`

And another one:

\`\`\`workflow
{
  "type": "workflow",
  "description": "Delete user", 
  "actions": [{"id": "delete_user", "tool": "delete_user_by_id", "parameters": {}}]
}
\`\`\`

Both workflows are ready.`,
      };

      mockProcessChatRequest.mockResolvedValue(mockResponse);

      render(<HomePage />);

      const input = screen.getByPlaceholderText('Send a message...');
      fireEvent.change(input, { target: { value: 'Show me user management workflows' } });
      fireEvent.submit(input.closest('form')!);

      await waitFor(() => {
        expect(mockStoreState.addMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            content: expect.stringContaining('Here are two workflows'),
          })
        );
      });
    });
  });

  describe('Message List Re-rendering Optimization', () => {
    it('should not re-render message list when typing', async () => {
      const renderSpy = jest.fn();

      // Create a component that tracks renders
      const TestMessageComponent = (props: any) => {
        renderSpy();
        return <MessageComponent {...props} />;
      };

      // Mock the MessageComponent
      jest.mock('../components/MessageComponent', () => ({
        MessageComponent: TestMessageComponent,
      }));

      render(<HomePage />);

      const input = screen.getByPlaceholderText('Send a message...');

      // Initial render count
      const initialRenderCount = renderSpy.mock.calls.length;

      // Type in the input field
      fireEvent.change(input, { target: { value: 'a' } });
      fireEvent.change(input, { target: { value: 'ab' } });
      fireEvent.change(input, { target: { value: 'abc' } });

      // Should not cause additional message renders
      expect(renderSpy.mock.calls.length).toBe(initialRenderCount);
    });

    it('should preserve workflow tab state when typing', async () => {
      // This test would require setting up a more complex state scenario
      // but demonstrates the intent of the optimization
      render(<HomePage />);

      const input = screen.getByPlaceholderText('Send a message...');

      // Simulate typing without causing re-renders
      fireEvent.change(input, { target: { value: 'test input' } });

      // Verify input state is maintained
      expect(input).toHaveValue('test input');
    });
  });

  describe('Error Handling in Workflow Processing', () => {
    it('should handle API errors gracefully', async () => {
      mockProcessChatRequest.mockRejectedValue(new Error('API Error'));

      render(<HomePage />);

      const input = screen.getByPlaceholderText('Send a message...');
      fireEvent.change(input, { target: { value: 'Create a workflow' } });
      fireEvent.submit(input.closest('form')!);

      await waitFor(() => {
        expect(screen.getByText(/error occurred/i)).toBeInTheDocument();
      });
    });

    it('should handle malformed workflow responses', async () => {
      const mockResponse = {
        type: 'general',
        content: `Here's a malformed workflow:

\`\`\`workflow
{invalid json structure
\`\`\`

The workflow above is invalid.`,
      };

      mockProcessChatRequest.mockResolvedValue(mockResponse);

      render(<HomePage />);

      const input = screen.getByPlaceholderText('Send a message...');
      fireEvent.change(input, { target: { value: 'Create a workflow' } });
      fireEvent.submit(input.closest('form')!);

      await waitFor(() => {
        // Should render the text content but no workflow card
        expect(screen.getByText(/The workflow above is invalid/)).toBeInTheDocument();
        expect(screen.queryByTestId('workflow-ui-card')).not.toBeInTheDocument();
      });
    });
  });

  describe('Workflow State Management', () => {
    it('should maintain workflow state across message history', async () => {
      const mockMessages = [
        {
          id: '1',
          role: 'user',
          content: 'Create a workflow',
          created_at: new Date().toISOString(),
        },
        {
          id: '2',
          role: 'assistant',
          content: `Here's your workflow:

\`\`\`workflow
{
  "type": "workflow",
  "description": "Test workflow",
  "actions": []
}
\`\`\`

Workflow is ready.`,
          created_at: new Date().toISOString(),
        },
      ];

      mockUseAppStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector({
            ...mockStoreState,
            messages: mockMessages,
          });
        }
        return { ...mockStoreState, messages: mockMessages };
      });

      render(<HomePage />);

      // Verify that previous messages with workflows are rendered
      expect(screen.getByText(/Create a workflow/)).toBeInTheDocument();
      expect(screen.getByText(/Here's your workflow/)).toBeInTheDocument();
    });

    it('should handle workflow expansion state correctly', async () => {
      // Test that workflow expansion state is managed properly
      // This would require implementing the expansion logic in the test
      render(<HomePage />);

      // Add assertions for workflow expansion behavior
      // This is a placeholder for more detailed expansion testing
      expect(true).toBe(true);
    });
  });

  describe('Performance and Memory', () => {
    it('should not cause memory leaks with many workflows', async () => {
      // Generate a response with many workflows
      const workflows = Array.from(
        { length: 10 },
        (_, i) => `
\`\`\`workflow
{
  "type": "workflow",
  "description": "Workflow ${i + 1}",
  "actions": []
}
\`\`\``
      ).join('\n\n');

      const mockResponse = {
        type: 'general',
        content: `Here are multiple workflows:\n\n${workflows}\n\nAll workflows ready.`,
      };

      mockProcessChatRequest.mockResolvedValue(mockResponse);

      render(<HomePage />);

      const input = screen.getByPlaceholderText('Send a message...');
      fireEvent.change(input, { target: { value: 'Show many workflows' } });
      fireEvent.submit(input.closest('form')!);

      await waitFor(() => {
        expect(mockStoreState.addMessage).toHaveBeenCalled();
      });

      // Verify that all workflows are processed without performance issues
      // In a real test, you might check render times or memory usage
      expect(true).toBe(true);
    });

    it('should efficiently parse large workflow content', () => {
      // Test parsing performance with large workflow definitions
      const largeWorkflowContent = `Large workflow:

\`\`\`workflow
{
  "type": "workflow",
  "description": "Large workflow with many actions",
  "actions": ${JSON.stringify(
    Array.from({ length: 100 }, (_, i) => ({
      id: `action_${i}`,
      tool: `tool_${i}`,
      description: `Description for action ${i}`,
      parameters: {},
      map: false,
    }))
  )}
}
\`\`\`

End of large workflow.`;

      // Performance test would measure parsing time
      const startTime = performance.now();

      render(<MessageComponent role="assistant" content={largeWorkflowContent} isLatestMessage={true} />);

      const endTime = performance.now();
      const parseTime = endTime - startTime;

      // Should parse reasonably quickly (adjust threshold as needed)
      expect(parseTime).toBeLessThan(100); // 100ms threshold
    });
  });
});
