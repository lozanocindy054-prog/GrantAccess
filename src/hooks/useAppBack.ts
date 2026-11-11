import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { canReturnToPath, fallbackBackPath, previousVisitedPath } from '../utils/backNavigation';
export const useAppBack = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  return useCallback(() => {
    const index = window.history.state?.idx;
    const previous = typeof index === 'number' ? previousVisitedPath(index) : undefined;
    if (typeof index === 'number' && index > 0 && canReturnToPath(pathname, previous)) navigate(-1);
    else navigate(fallbackBackPath(pathname), { replace: true });
  }, [navigate, pathname]);
};
