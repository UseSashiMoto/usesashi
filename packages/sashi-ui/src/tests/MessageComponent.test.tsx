import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MessageComponent } from '../components/MessageComponent';
import useAppStore from '../store/chat-store';

// Mock the app store
jest.mock('../store/chat-store');
const mockUseAppStore = useAppStore as jest.MockedFunction<typeof useAppStore>;

// Mock the WorkflowUICard component
jest.mock('../components/workflows/WorkflowUICard', () => ({
  WorkflowUICard: ({ workflow, isInChat }: any) => (
    <div data-testid="workflow-ui-card">
      <div data-testid="workflow-description">{workflow.entry.description}</div>
      <div data-testid="workflow-actions-count">{workflow.workflow.actions?.length || 0}</div>
      <div data-testid="is-in-chat">{isInChat.toString()}</div>
    </div>
  ),
}));

describe('MessageComponent - Embedded Workflows', () => {
  beforeEach(() => {
    // Setup default mock return values
    mockUseAppStore.mockReturnValue('http://localhost:3000/api');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Text Message Rendering', () => {
    it('should render plain text message without workflows', () => {
      render(
        <MessageComponent
          role="assistant"
          content="This is a simple text message without any workflows."
          isLatestMessage={false}
        />
      );

      expect(screen.getByText('This is a simple text message without any workflows.')).toBeInTheDocument();
      expect(screen.queryByTestId('workflow-ui-card')).not.toBeInTheDocument();
    });

    it('should render text message with markdown formatting', () => {
      const content = 'Here\'s some **bold text** and a code block:\n\n```json\n{"key": "value"}\n```';

      render(<MessageComponent role="assistant" content={content} isLatestMessage={false} />);

      expect(screen.getByText(/bold text/)).toBeInTheDocument();
      expect(screen.getByText(/{"key": "value"}/)).toBeInTheDocument();
    });
  });

  describe('Single Embedded Workflow', () => {
    const singleWorkflowContent = `I'll help you get user information. Here's a workflow:

\`\`\`workflow
{
  "type": "workflow",
  "description": "Get user by ID",
  "actions": [
    {
      "id": "get_user",
      "tool": "get_user_by_id",
      "description": "Fetch user information",
      "parameters": {"userId": "userInput.userId"},
      "parameterMetadata": {
        "userId": {"type": "string", "required": true}
      },
      "map": false
    }
  ]
}
\`\`\`

This workflow will retrieve the user data for you.`;

    it('should render embedded workflow with surrounding text', () => {
      render(<MessageComponent role="assistant" content={singleWorkflowContent} isLatestMessage={true} />);

      // Check that text content is rendered (without workflow blocks)
      expect(screen.getByText(/I'll help you get user information/)).toBeInTheDocument();
      expect(screen.getByText(/This workflow will retrieve the user data/)).toBeInTheDocument();

      // Check that workflow card is rendered
      expect(screen.getByTestId('workflow-ui-card')).toBeInTheDocument();
      expect(screen.getByTestId('workflow-description')).toHaveTextContent('Get user by ID');
      expect(screen.getByTestId('workflow-actions-count')).toHaveTextContent('1');
      expect(screen.getByTestId('is-in-chat')).toHaveTextContent('true');
    });

    it('should not render workflow blocks in text content', () => {
      render(<MessageComponent role="assistant" content={singleWorkflowContent} isLatestMessage={true} />);

      // Workflow blocks should not appear in the text content
      expect(screen.queryByText(/```workflow/)).not.toBeInTheDocument();
      expect(screen.queryByText(/```/)).not.toBeInTheDocument();
    });
  });

  describe('Multiple Embedded Workflows', () => {
    const multipleWorkflowContent = `Here are two workflows for you:

\`\`\`workflow
{
  "type": "workflow",
  "description": "Get user",
  "actions": [{"id": "get_user", "tool": "get_user_by_id", "parameters": {}}]
}
\`\`\`

Between workflows text.

\`\`\`workflow
{
  "type": "workflow", 
  "description": "Delete user",
  "actions": [{"id": "delete_user", "tool": "delete_user_by_id", "parameters": {}}]
}
\`\`\`

All workflows are ready.`;

    it('should render multiple embedded workflows', () => {
      render(<MessageComponent role="assistant" content={multipleWorkflowContent} isLatestMessage={true} />);

      // Should render multiple workflow cards
      const workflowCards = screen.getAllByTestId('workflow-ui-card');
      expect(workflowCards).toHaveLength(2);

      // Check text content between workflows
      expect(screen.getByText(/Here are two workflows/)).toBeInTheDocument();
      expect(screen.getByText(/Between workflows text/)).toBeInTheDocument();
      expect(screen.getByText(/All workflows are ready/)).toBeInTheDocument();
    });

    it('should render workflows for latest message only as interactive', () => {
      render(<MessageComponent role="assistant" content={multipleWorkflowContent} isLatestMessage={true} />);

      const workflowCards = screen.getAllByTestId('workflow-ui-card');
      workflowCards.forEach((card) => {
        expect(card.querySelector('[data-testid="is-in-chat"]')).toHaveTextContent('true');
      });
    });

    it('should render workflows for non-latest messages as collapsed', () => {
      render(<MessageComponent role="assistant" content={multipleWorkflowContent} isLatestMessage={false} />);

      // For non-latest messages, should show collapsed workflow cards
      const collapsedCards = screen.getAllByTestId('collapsed-workflow-card');
      expect(collapsedCards).toHaveLength(2);
    });
  });

  describe('Workflow Expansion Behavior', () => {
    const workflowContent = `\`\`\`workflow
{
  "type": "workflow",
  "description": "Test workflow",
  "actions": []
}
\`\`\``;

    it('should handle workflow expansion for previous messages', () => {
      render(<MessageComponent role="assistant" content={workflowContent} isLatestMessage={false} />);

      const collapsedCard = screen.getByTestId('collapsed-workflow-card');
      expect(collapsedCard).toBeInTheDocument();

      // Click to expand
      const expandButton = screen.getByTestId('expand-workflow-button');
      fireEvent.click(expandButton);

      // Should show expanded workflow
      expect(screen.getByTestId('workflow-ui-card')).toBeInTheDocument();
    });

    it('should collapse other workflows when expanding one', async () => {
      const multiWorkflowContent = `\`\`\`workflow
{"type": "workflow", "description": "First workflow", "actions": []}
\`\`\`

\`\`\`workflow
{"type": "workflow", "description": "Second workflow", "actions": []}
\`\`\``;

      render(<MessageComponent role="assistant" content={multiWorkflowContent} isLatestMessage={false} />);

      const expandButtons = screen.getAllByTestId('expand-workflow-button');

      // Expand first workflow
      fireEvent.click(expandButtons[0]);

      expect(screen.getByTestId('workflow-ui-card')).toBeInTheDocument();

      // Expand second workflow should collapse first
      fireEvent.click(expandButtons[1]);

      await waitFor(() => {
        const workflowCards = screen.getAllByTestId('workflow-ui-card');
        expect(workflowCards).toHaveLength(1);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid JSON in workflow blocks gracefully', () => {
      const invalidWorkflowContent = `Here's a workflow:

\`\`\`workflow
{invalid json}
\`\`\`

Text after invalid workflow.`;

      render(<MessageComponent role="assistant" content={invalidWorkflowContent} isLatestMessage={true} />);

      // Should render text but no workflow card
      expect(screen.getByText(/Here's a workflow/)).toBeInTheDocument();
      expect(screen.getByText(/Text after invalid workflow/)).toBeInTheDocument();
      expect(screen.queryByTestId('workflow-ui-card')).not.toBeInTheDocument();
    });

    it('should handle missing required workflow fields', () => {
      const incompleteWorkflowContent = `\`\`\`workflow
{
  "type": "workflow",
  "description": "Incomplete workflow"
}
\`\`\``;

      render(<MessageComponent role="assistant" content={incompleteWorkflowContent} isLatestMessage={true} />);

      // Should not render workflow card for incomplete workflow
      expect(screen.queryByTestId('workflow-ui-card')).not.toBeInTheDocument();
    });
  });

  describe('Message Types', () => {
    it('should handle user messages without workflow parsing', () => {
      const userMessageWithWorkflowSyntax = `Can you create a workflow like this:

\`\`\`workflow
{"type": "workflow", "actions": []}
\`\`\``;

      render(<MessageComponent role="user" content={userMessageWithWorkflowSyntax} isLatestMessage={false} />);

      // User messages should not parse workflows
      expect(screen.queryByTestId('workflow-ui-card')).not.toBeInTheDocument();
      expect(screen.getByText(/Can you create a workflow/)).toBeInTheDocument();
    });

    it('should handle error messages', () => {
      render(
        <MessageComponent
          role="assistant"
          content="An error occurred while processing your request."
          isError={true}
          isLatestMessage={false}
        />
      );

      const messageElement = screen.getByText(/An error occurred/);
      expect(messageElement).toBeInTheDocument();
      expect(messageElement.closest('div')).toHaveClass(/text-red/);
    });

    it('should handle thinking state', () => {
      render(<MessageComponent role="assistant" content="Thinking..." isThinking={true} isLatestMessage={true} />);

      expect(screen.getByTestId('thinking-indicator')).toBeInTheDocument();
    });
  });

  describe('Integration with Store', () => {
    it('should use API URL from store for workflow cards', () => {
      const testApiUrl = 'https://test-api.example.com';
      mockUseAppStore.mockReturnValue(testApiUrl);

      const workflowContent = `\`\`\`workflow
{
  "type": "workflow",
  "description": "Test workflow",
  "actions": []
}
\`\`\``;

      render(<MessageComponent role="assistant" content={workflowContent} isLatestMessage={true} />);

      expect(mockUseAppStore).toHaveBeenCalled();
      expect(screen.getByTestId('workflow-ui-card')).toBeInTheDocument();
    });
  });
});
