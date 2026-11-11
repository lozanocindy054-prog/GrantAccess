import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { onIdTokenChanged } from 'firebase/auth';
import { auth } from '../Firebase/config';
import { isAdministrator } from '../services/adminService';
import './AdminTabs.css';
const tabs = [
  ['Dashboard', '/admin-dashboard'], ['Students', '/admin-students'], ['Organizations', '/admin-organizations'],
  ['Scholarships', '/admin-scholarships'], ['Applications', '/admin-applications'], ['Reports', '/admin-reports'],
  ['Notifications', '/admin-notifications'], ['Activity', '/admin-activity-logs'], ['Settings', '/admin-settings'],
];
const AdminTabs = () => {
  const { pathname } = useLocation(); const navigate = useNavigate();
  const protectedRoute = tabs.some(([, path]) => path === pathname);
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    if (!protectedRoute) return;
    let generation = 0;
    const stop = onIdTokenChanged(auth, user => {
      const current = ++generation; setAllowed(false);
      if (user?.emailVerified) void isAdministrator(user).then(admin => { if (current === generation) setAllowed(admin); }).catch(() => {});
    });
    return () => { generation++; stop(); };
  }, [protectedRoute]);
  const visible = protectedRoute && allowed;
  useEffect(() => {
    const app = document.querySelector('ion-app'); app?.classList.toggle('ga-with-admin-tabs', visible);
    return () => app?.classList.remove('ga-with-admin-tabs');
  }, [visible]);
  if (!visible) return null;
  return <nav className="admin-route-tabs" aria-label="Admin tabs">{tabs.map(([label, path]) => <button key={path} type="button" aria-current={pathname === path ? 'page' : undefined} onClick={() => { if (pathname !== path) navigate(path); }}>{label}</button>)}</nav>;
};
export default AdminTabs;
