import React from 'react';
import { render as rtlRender, RenderOptions } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

function render(ui: React.ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  return rtlRender(ui, { wrapper: MemoryRouter, ...options });
}

// Re-export everything from Testing Library
export * from '@testing-library/react';

// Override render method
export { render }; 