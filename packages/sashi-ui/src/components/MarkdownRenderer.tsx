import React, { useMemo } from 'react';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

// Simple code highlighting for common languages
const highlightCode = (code: string, language?: string): string => {
  // Basic syntax highlighting for common patterns
  let highlighted = code;

  if (language === 'javascript' || language === 'js' || language === 'typescript' || language === 'ts') {
    highlighted = highlighted
      .replace(
        /\b(const|let|var|function|class|if|else|for|while|return|import|export|from|default)\b/g,
        '<span class="text-purple-600 dark:text-purple-400 font-semibold">$1</span>'
      )
      .replace(/\b(true|false|null|undefined)\b/g, '<span class="text-blue-600 dark:text-blue-400">$1</span>')
      .replace(/(\/\/.*$)/gm, '<span class="text-gray-500 dark:text-gray-400 italic">$1</span>')
      .replace(/('[^']*'|"[^"]*")/g, '<span class="text-green-600 dark:text-green-400">$1</span>');
  } else if (language === 'json') {
    highlighted = highlighted
      .replace(/("[^"]*")\s*:/g, '<span class="text-blue-600 dark:text-blue-400">$1</span>:')
      .replace(/:\s*("[^"]*")/g, ': <span class="text-green-600 dark:text-green-400">$1</span>')
      .replace(/\b(true|false|null)\b/g, '<span class="text-purple-600 dark:text-purple-400">$1</span>');
  } else if (language === 'css') {
    highlighted = highlighted
      .replace(/([.#][a-zA-Z-]+)/g, '<span class="text-blue-600 dark:text-blue-400">$1</span>')
      .replace(/([a-zA-Z-]+):/g, '<span class="text-purple-600 dark:text-purple-400">$1</span>:');
  }

  return highlighted;
};

// Enhanced markdown processor
const processMarkdown = (content: string): string => {
  let processed = content;

  // Process code blocks first (multiline)
  processed = processed.replace(/```(\w+)?\n([\s\S]*?)\n```/g, (match, language, code) => {
    const highlightedCode = highlightCode(code, language);
    return `<pre class="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg border overflow-x-auto"><code class="text-sm font-mono">${highlightedCode}</code></pre>`;
  });

  // Process inline code
  processed = processed.replace(
    /`([^`]+)`/g,
    '<code class="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-sm font-mono border">$1</code>'
  );

  // Process headers
  processed = processed.replace(/^### (.*$)/gm, '<h3 class="text-lg font-bold mb-2 mt-4">$1</h3>');
  processed = processed.replace(/^## (.*$)/gm, '<h2 class="text-xl font-bold mb-3 mt-4">$1</h2>');
  processed = processed.replace(/^# (.*$)/gm, '<h1 class="text-2xl font-bold mb-4 mt-4">$1</h1>');

  // Process bold and italic
  processed = processed.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold">$1</strong>');
  processed = processed.replace(/\*(.*?)\*/g, '<em class="italic">$1</em>');

  // Process links
  processed = processed.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" class="text-blue-600 dark:text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer">$1</a>'
  );

  // Process lists
  processed = processed.replace(/^- (.*$)/gm, '<li class="ml-4">$1</li>');
  processed = processed.replace(/(<li[\s\S]*?<\/li>)/g, '<ul class="list-disc list-inside space-y-1 mb-2">$1</ul>');

  // Process numbered lists
  processed = processed.replace(/^\d+\. (.*$)/gm, '<li class="ml-4">$1</li>');

  // Process blockquotes
  processed = processed.replace(
    /^> (.*$)/gm,
    '<blockquote class="border-l-4 border-blue-500 pl-4 italic text-gray-600 dark:text-gray-400 my-2">$1</blockquote>'
  );

  // Process line breaks (keep double line breaks as paragraphs)
  processed = processed.replace(/\n\n/g, '</p><p class="mb-2">');
  processed = processed.replace(/\n/g, '<br>');

  // Wrap in paragraph if doesn't start with a block element
  if (!processed.match(/^<(h[1-6]|pre|ul|ol|blockquote|div)/)) {
    processed = `<p class="mb-2">${processed}</p>`;
  }

  return processed;
};

export const MarkdownRenderer = ({ content, className = '' }: MarkdownRendererProps) => {
  // Process markdown content
  const processedContent = useMemo(() => {
    return processMarkdown(content);
  }, [content]);

  return (
    <div
      className={`prose prose-sm max-w-none dark:prose-invert ${className}`}
      dangerouslySetInnerHTML={{ __html: processedContent }}
    />
  );
};

// Legacy export for backward compatibility
export const ClientMarkdown = MarkdownRenderer;
