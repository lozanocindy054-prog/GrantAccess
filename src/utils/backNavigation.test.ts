import { describe, expect, it } from 'vitest';
import { canReturnToPath, fallbackBackPath } from './backNavigation';
describe('safe back navigation', () => {
  it('returns within the same account portal', () => {
    expect(canReturnToPath('/lgu-messages', '/lgu-dashboard')).toBe(true);
    expect(canReturnToPath('/scholarships', '/student-dashboard')).toBe(true);
  });
  it('does not send signed-out login pages back into private interfaces', () => {
    expect(canReturnToPath('/lgu-login', '/lgu-dashboard')).toBe(false);
    expect(canReturnToPath('/login', '/profile')).toBe(false);
  });
  it('avoids login history and cross-portal returns from protected pages', () => {
    expect(canReturnToPath('/lgu-scholarships', '/lgu-login')).toBe(false);
    expect(canReturnToPath('/lgu-messages', '/student-dashboard')).toBe(false);
    expect(canReturnToPath('/profile', '//example.com')).toBe(false);
  });
  it('uses a usable fallback for direct visits', () => {
    expect(fallbackBackPath('/lgu-applications')).toBe('/lgu-dashboard');
    expect(fallbackBackPath('/scholarships')).toBe('/student-dashboard');
    expect(fallbackBackPath('/admin-reports')).toBe('/admin-dashboard');
    expect(fallbackBackPath('/lgu-login')).toBe('/register-choice');
  });
});
