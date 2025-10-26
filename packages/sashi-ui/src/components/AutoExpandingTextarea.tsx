import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';

interface AutoExpandingTextareaProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  maxRows?: number;
  minRows?: number;
}

/**
 * Auto-expanding textarea for chat input
 * Features:
 * - Automatically grows as user types
 * - Enter to submit, Shift+Enter for new line
 * - Constrainable max/min rows
 * - Smooth transitions
 */
export const AutoExpandingTextarea = forwardRef<HTMLTextAreaElement, AutoExpandingTextareaProps>(
  (
    {
      value,
      onChange,
      onSubmit,
      placeholder = 'Type a message...',
      disabled = false,
      className = '',
      maxRows = 10,
      minRows = 1,
    },
    ref
  ) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Expose textarea ref to parent
    useImperativeHandle(ref, () => textareaRef.current!);

    // Auto-resize textarea based on content
    const adjustHeight = () => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      // Reset height to measure content
      textarea.style.height = 'auto';

      // Calculate line height
      const computedStyle = window.getComputedStyle(textarea);
      const lineHeight = parseInt(computedStyle.lineHeight, 10);

      // Calculate min and max height
      const minHeight = lineHeight * minRows;
      const maxHeight = lineHeight * maxRows;

      // Set new height constrained by min/max
      const newHeight = Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight);
      textarea.style.height = `${newHeight}px`;
    };

    // Adjust height when value changes
    useEffect(() => {
      adjustHeight();
    }, [value]);

    // Handle key press
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Submit on Enter (without Shift)
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (onSubmit && value.trim()) {
          onSubmit();
        }
      }
    };

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e.target.value);
    };

    return (
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={minRows}
        className={`resize-none overflow-y-auto transition-all duration-150 ${className}`}
        style={{
          scrollBehavior: 'smooth',
        }}
      />
    );
  }
);

AutoExpandingTextarea.displayName = 'AutoExpandingTextarea';

