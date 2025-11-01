import useAppStore from '@/store/chat-store';
import React from 'react';

type Variant = 'basenameMismatch' | 'routeNotFound';

type Props = {
  variant: Variant;
  expectedBase?: string;
  currentPath?: string;
};

export const NotFoundPage: React.FC<Props> = ({ variant, expectedBase, currentPath }) => {
  const apiUrl = useAppStore((s) => s.apiUrl);

  const title = variant === 'basenameMismatch' ? 'Invalid mount path' : 'Route not found';

  return (
    <div className="p-6 m-6 rounded-md border border-red-300 bg-red-50 text-red-900">
      <div className="text-lg font-semibold">{title}</div>

      {variant === 'basenameMismatch' && (
        <div className="mt-2">
          <div className="font-mono text-sm">
            Expected path to start with <strong>{expectedBase}</strong>, but current path is{' '}
            <strong>{currentPath}</strong>.
          </div>
          <div className="mt-3 text-sm">
            How to fix:
            <ul className="list-disc ml-5 mt-1">
              <li>Navigate your app under the expected base path.</li>
              <li>
                Or pass a matching <code>baseName</code> prop to <code>SashiApp</code> so the router mounts where you
                render it.
              </li>
              <li>
                Verify API is reachable at <code>{apiUrl || '(not set)'}</code>.
              </li>
            </ul>
          </div>
        </div>
      )}

      {variant === 'routeNotFound' && (
        <div className="mt-2">
          <div className="font-mono text-sm">
            No route matched <strong>{currentPath}</strong> under the current base.
          </div>
          <div className="mt-3 text-sm">
            Try:
            <ul className="list-disc ml-5 mt-1">
              <li>Go to Home</li>
              <li>
                Use a known route: <code>/</code>, <code>/dashboard</code>, <code>/setting</code>,{' '}
                <code>/audit-logs</code>
              </li>
              <li>Confirm your base path aligns with where this component is mounted.</li>
            </ul>
          </div>
        </div>
      )}

      <div className="mt-4">
        {/* Use plain anchor to avoid Router context dependency */}
        <a href="/" className="text-sm underline text-red-800">
          Go to Home
        </a>
      </div>

      <div className="mt-4 text-xs text-red-800/80 font-mono">
        Debug:
        <div>apiUrl: {apiUrl || '(not set)'}</div>
        {expectedBase && <div>expectedBase: {expectedBase}</div>}
        {currentPath && <div>currentPath: {currentPath}</div>}
      </div>
    </div>
  );
};
