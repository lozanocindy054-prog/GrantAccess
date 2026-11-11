
import { render, screen } from '@testing-library/react';
import { test, expect } from 'vitest';
import App from './App';

test('renders the GrantAccess app', async () => {
  const { baseElement } = render(<App />);
  expect(baseElement).toBeTruthy();
  expect(await screen.findByRole('heading', { name: /Education opens doors/i })).toBeTruthy();
});
