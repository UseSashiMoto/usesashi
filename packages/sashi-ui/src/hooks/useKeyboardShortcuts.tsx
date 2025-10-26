import React, { useEffect, useCallback } from 'react';

export interface KeyboardShortcut {
    key: string;
    ctrlOrCmd?: boolean;
    shift?: boolean;
    alt?: boolean;
    handler: (event: KeyboardEvent) => void;
    description: string;
}

/**
 * Hook to register keyboard shortcuts
 * Automatically handles cross-platform Ctrl/Cmd key
 * 
 * @example
 * useKeyboardShortcuts([
 *   {
 *     key: 'k',
 *     ctrlOrCmd: true,
 *     handler: () => focusSearch(),
 *     description: 'Focus search'
 *   }
 * ]);
 */
export const useKeyboardShortcuts = (shortcuts: KeyboardShortcut[]) => {
    const handleKeyDown = useCallback((event: KeyboardEvent) => {
        for (const shortcut of shortcuts) {
            const matchesKey = event.key.toLowerCase() === shortcut.key.toLowerCase();
            const matchesCtrlCmd = !shortcut.ctrlOrCmd || (event.ctrlKey || event.metaKey);
            const matchesShift = !shortcut.shift || event.shiftKey;
            const matchesAlt = !shortcut.alt || event.altKey;

            if (matchesKey && matchesCtrlCmd && matchesShift && matchesAlt) {
                event.preventDefault();
                shortcut.handler(event);
                break;
            }
        }
    }, [shortcuts]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    return shortcuts;
};

/**
 * Pre-defined chat shortcuts
 * Returns shortcuts with bound handlers
 */
export const useChatKeyboardShortcuts = ({
    onClearInput,
    onFocusInput,
    onClearMessages,
    onScrollToBottom,
    onEditLastMessage,
}: {
    onClearInput?: () => void;
    onFocusInput?: () => void;
    onClearMessages?: () => void;
    onScrollToBottom?: () => void;
    onEditLastMessage?: () => void;
}) => {
    const shortcuts: KeyboardShortcut[] = [
        {
            key: 'Escape',
            handler: () => onClearInput?.(),
            description: 'Clear input',
        },
        {
            key: 'k',
            ctrlOrCmd: true,
            handler: () => onFocusInput?.(),
            description: 'Focus input (Ctrl/Cmd + K)',
        },
        {
            key: 'l',
            ctrlOrCmd: true,
            handler: () => onClearMessages?.(),
            description: 'Clear all messages (Ctrl/Cmd + L)',
        },
        {
            key: 'b',
            ctrlOrCmd: true,
            handler: () => onScrollToBottom?.(),
            description: 'Scroll to bottom (Ctrl/Cmd + B)',
        },
        {
            key: 'ArrowUp',
            handler: () => onEditLastMessage?.(),
            description: 'Edit last message (Arrow Up)',
        },
    ];

    return useKeyboardShortcuts(shortcuts);
};

/**
 * Component to display available keyboard shortcuts
 */
export const KeyboardShortcutsHelp: React.FC<{ shortcuts: KeyboardShortcut[] }> = ({ shortcuts }) => {
  return (
    <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
      <h3 className="text-sm font-bold mb-2">⌨️ Keyboard Shortcuts</h3>
      <div className="space-y-1">
        {shortcuts.map((shortcut, index) => (
          <div key={index} className="text-xs flex justify-between">
            <span>{shortcut.description}</span>
            <span className="font-mono bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded">
              {shortcut.ctrlOrCmd && 'Ctrl/⌘ + '}
              {shortcut.shift && 'Shift + '}
              {shortcut.alt && 'Alt + '}
              {shortcut.key}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

