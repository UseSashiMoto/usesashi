import { render, screen } from '@testing-library/react';
import React from 'react';
import HelloWorld from './HelloWorld';

test('renders Hello, World!', () => {
  render(<HelloWorld />);
  expect(screen.getByText('Hello, World!')).toBeInTheDocument();
}); 