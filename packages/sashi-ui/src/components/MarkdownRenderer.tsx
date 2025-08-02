import React, { lazy, Suspense, useMemo } from 'react';

// Lazy load markdown components to avoid SSR issues
const ReactMarkdown = lazy(() => import('react-markdown'));

// Dynamically load highlight.js styles only in browser environment
if (typeof window !== 'undefined') {
  try {
    import('highlight.js/styles/github.css');
  } catch {
    // Styles failed to load, continue without syntax highlighting styles
  }
}

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

// Simple fallback component for when markdown can't be loaded
const MarkdownFallback = ({ content, className = '' }: MarkdownRendererProps) => {
  // Basic text processing for fallback
  const processedContent = useMemo(() => {
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold text
      .replace(/\*(.*?)\*/g, '<em>$1</em>') // Italic text
      .replace(/`([^`]+)`/g, '<code class="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-sm">$1</code>') // Inline code
      .replace(/\n/g, '<br>'); // Line breaks
  }, [content]);

  return (
    <div
      className={`prose prose-sm max-w-none dark:prose-invert ${className}`}
      dangerouslySetInnerHTML={{ __html: processedContent }}
    />
  );
};

// Loading component
const MarkdownLoader = () => (
  <div className="animate-pulse">
    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-2"></div>
    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
  </div>
);

// Full markdown component with all features
const FullMarkdownRenderer = ({ content, className = '' }: MarkdownRendererProps) => {
  // Dynamic imports for plugins to avoid SSR issues
  const [plugins, setPlugins] = React.useState<any>({ remarkGfm: null, rehypeHighlight: null, rehypeRaw: null });

  React.useEffect(() => {
    // Only load plugins in browser environment
    if (typeof window !== 'undefined') {
      Promise.all([import('remark-gfm'), import('rehype-highlight'), import('rehype-raw')])
        .then(([remarkGfm, rehypeHighlight, rehypeRaw]) => {
          setPlugins({
            remarkGfm: remarkGfm.default,
            rehypeHighlight: rehypeHighlight.default,
            rehypeRaw: rehypeRaw.default,
          });
        })
        .catch(() => {
          // Plugins failed to load, will use basic markdown
        });
    }
  }, []);

  return (
    <ReactMarkdown
      remarkPlugins={plugins.remarkGfm ? [plugins.remarkGfm] : []}
      rehypePlugins={plugins.rehypeHighlight && plugins.rehypeRaw ? [plugins.rehypeHighlight, plugins.rehypeRaw] : []}
      components={{
        // Custom styling for code blocks
        pre: ({ node, ...props }: any) => (
          <pre {...props} className="bg-gray-100 dark:bg-gray-800 p-3 rounded-md text-sm overflow-x-auto border" />
        ),
        code: ({ node, inline, ...props }: any) => (
          <code {...props} className={inline ? 'bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-sm' : ''} />
        ),
        // Custom styling for tables
        table: ({ node, ...props }: any) => (
          <table {...props} className="border-collapse border border-gray-300 dark:border-gray-600 w-full" />
        ),
        th: ({ node, ...props }: any) => (
          <th
            {...props}
            className="border border-gray-300 dark:border-gray-600 px-3 py-2 bg-gray-50 dark:bg-gray-700 font-semibold"
          />
        ),
        td: ({ node, ...props }: any) => (
          <td {...props} className="border border-gray-300 dark:border-gray-600 px-3 py-2" />
        ),
        // Custom styling for blockquotes
        blockquote: ({ node, ...props }: any) => (
          <blockquote {...props} className="border-l-4 border-blue-500 pl-4 italic text-gray-600 dark:text-gray-400" />
        ),
        // Custom styling for headings
        h1: ({ node, ...props }: any) => <h1 {...props} className="text-2xl font-bold mb-2" />,
        h2: ({ node, ...props }: any) => <h2 {...props} className="text-xl font-bold mb-2" />,
        h3: ({ node, ...props }: any) => <h3 {...props} className="text-lg font-bold mb-2" />,
        // Custom styling for lists
        ul: ({ node, ...props }: any) => <ul {...props} className="list-disc list-inside space-y-1" />,
        ol: ({ node, ...props }: any) => <ol {...props} className="list-decimal list-inside space-y-1" />,
        // Custom styling for links
        a: ({ node, ...props }: any) => (
          <a
            {...props}
            className="text-blue-600 dark:text-blue-400 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          />
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
};

export const MarkdownRenderer = ({ content, className = '' }: MarkdownRendererProps) => {
  // Check if we're in a browser environment
  const isBrowser = typeof window !== 'undefined';

  // If not in browser environment, use fallback
  if (!isBrowser) {
    return <MarkdownFallback content={content} className={className} />;
  }

  // In browser environment, use Suspense with lazy loading
  return (
    <div className={`prose prose-sm max-w-none dark:prose-invert ${className}`}>
      <Suspense fallback={<MarkdownLoader />}>
        <FullMarkdownRenderer content={content} className={className} />
      </Suspense>
    </div>
  );
};

// Legacy export for backward compatibility
export const ClientMarkdown = MarkdownRenderer;
