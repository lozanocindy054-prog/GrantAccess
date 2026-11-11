const PUBLIC = new Set(['/', '/register-choice', '/login', '/lgu-login', '/admin-login', '/student-register', '/lgu-register', '/admin-register', '/forgot-password']);
export const routeSection = (path: string): 'public' | 'organization' | 'admin' | 'student' | 'file' => {
  if (PUBLIC.has(path)) return 'public';
  if (path.startsWith('/lgu-')) return 'organization';
  if (path.startsWith('/admin-')) return 'admin';
  if (path.startsWith('/files/')) return 'file';
  return 'student';
};
export const fallbackBackPath = (path: string): string => {
  const section = routeSection(path);
  return section === 'organization' ? '/lgu-dashboard' : section === 'admin' ? '/admin-dashboard' : section === 'student' ? '/student-dashboard' : '/register-choice';
};
export const canReturnToPath = (current: string, previous?: string): boolean => {
  if (!previous || previous === current || !previous.startsWith('/') || previous.startsWith('//')) return false;
  const currentSection = routeSection(current);
  const previousSection = routeSection(previous);
  if (currentSection === 'file') return ['student', 'organization', 'admin'].includes(previousSection);
  return currentSection === previousSection;
};

const visitedPaths = new Map<number, string>();
export const recordVisitedPath = (index: number, path: string): void => { visitedPaths.set(index, path); };
export const previousVisitedPath = (index: number): string | undefined => visitedPaths.get(index - 1);
