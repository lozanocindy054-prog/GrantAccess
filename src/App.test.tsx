
import { render } from '@testing-library/react';
import { test, expect } from 'vitest';
import App from './App';

test('renders the GrantAccess app', () => {
  const { baseElement } = render(<App />);
  expect(baseElement).toBeTruthy();
});
