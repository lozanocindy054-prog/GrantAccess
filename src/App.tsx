
import React, { useEffect } from 'react';
import {
  Navigate,
  Route,
  useLocation,
} from 'react-router-dom';

import {
  IonApp,
  IonRouterOutlet,
  setupIonicReact,
} from '@ionic/react';

import { IonReactRouter } from '@ionic/react-router';
import GlobalBackButton from './components/GlobalBackButton';

// ==========================================
// STUDENT REGISTRATION AND AUTHENTICATION
// ==========================================
import RegisterChoice from './pages/RegisterChoice/RegisterChoice';
import StudentRegister from './pages/StudentRegister/StudentRegister';
import LoginStudent from './pages/LoginStudent/LoginStudent';
import ForgotPassword from './pages/ForgotPassword/ForgotPassword';

// ==========================================
// LGU / SCHOOL REGISTRATION AND LOGIN
// ==========================================
import LGUSchoolRegister from './lgu & school/Register/Register';
import LGUSchoolLogin from './lgu & school/LoginLGUSchool/LoginLGUSchool';

// ==========================================
// LGU / SCHOOL DASHBOARD
// ==========================================
import LGUSchoolDashboard from './lgu & school/LGUSchoolDashboard/LGUSchoolDashboard';
import StudentMap from './lgu & school/StudentMap/StudentMap';

// ==========================================
// LGU / SCHOOL PROFILE
// ==========================================
import LGUSchoolProfile from './lgu & school/LGUSchoolProfile/LGUSchoolProfile';

// ==========================================
// LGU / SCHOOL SCHOLARSHIP MANAGEMENT
// ==========================================
import ManageScholarships from './lgu & school/ManageScholarships/ManageScholarships';

// ==========================================
// LGU / SCHOOL APPLICATIONS
// ==========================================
import Applications from './lgu & school/Applications/Applications';

// ==========================================
// LGU / SCHOOL MESSAGING
// ==========================================
import LGUSchoolMessages from './lgu & school/Messages/Messages';

// ==========================================
// ADMIN REGISTRATION AND LOGIN
// ==========================================
import RegisterAdmin from './Admin/RegisterAdmin/RegisterAdmin';
import LoginAdmin from './Admin/LoginAdmin/LoginAdmin';

// ==========================================
// ADMIN DASHBOARD
// ==========================================
import AdminDashboard from './Admin/AdminDashboard/AdminDashboard';

// ==========================================
// ADMIN MANAGEMENT PAGES
// ==========================================
import RegisteredStudents from './Admin/AdminStudents/RegisteredStudents';
import LGUSchoolAccounts from './Admin/AdminOrganizations/LGUSchoolAccounts';
import AdminScholarships from './Admin/AdminScholarships/AdminScholarships';
import AdminApplications from './Admin/AdminApplications/AdminApplications';

// ==========================================
// ADMIN REPORTS, NOTIFICATIONS, ACTIVITY LOGS
// ==========================================
import AdminReports from './Admin/AdminReports/AdminReports';
import AdminNotifications from './Admin/AdminNotifications/AdminNotifications';
import AdminActivityLogs from './Admin/AdminActivityLogs/AdminActivityLogs';

// ==========================================
// STUDENT PAGES
// ==========================================
import StudentHome from './pages/StudentHome/StudentHome';
import StudentLocation from './pages/StudentLocation/StudentLocation';
import OrganizationProfile from './pages/OrganizationProfile/OrganizationProfile';
import Scholarships from './pages/Scholarships/Scholarships';
import StudentApplication from './pages/StudentApplication/StudentApplication';
import StudentNotifications from './pages/StudentNotifications/StudentNotifications';
import ApplicationHistory from './pages/ApplicationHistory/ApplicationHistory';
import Saved from './pages/Saved/Saved';
import Profile from './pages/Profile/Profile';

// ==========================================
// STUDENT MESSAGING
// ==========================================
import Messages from './pages/Message/Messages';

// ==========================================
// IONIC CSS
// ==========================================
import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';

import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';

import '@ionic/react/css/palettes/dark.system.css';

// ==========================================
// THEME
// ==========================================
import './theme/variables.css';
import './theme/grant-access-palette.css';

setupIonicReact();

// ==========================================
// ROUTE FOCUS HANDLER
// ==========================================
const RouteFocusHandler: React.FC = () => {
  const location = useLocation();

  useEffect(() => {
    const activeElement = document.activeElement;

    if (
      activeElement instanceof HTMLElement &&
      activeElement !== document.body
    ) {
      activeElement.blur();
    }
  }, [location.pathname]);

  return null;
};

// ==========================================
// MAIN APP
// ==========================================
const App: React.FC = () => {
  return (
    <IonApp>
      <IonReactRouter>
        <RouteFocusHandler />
        <GlobalBackButton />

        <IonRouterOutlet animated={false}>

          {/* ======================================
              STUDENT REGISTRATION AND AUTHENTICATION
          ====================================== */}

          <Route
            path="/register-choice"
            element={<RegisterChoice />}
          />

          <Route
            path="/student-register"
            element={<StudentRegister />}
          />

          <Route
            path="/login"
            element={<LoginStudent />}
          />

          <Route
            path="/forgot-password"
            element={<ForgotPassword />}
          />

          {/* ======================================
              LGU / SCHOOL REGISTRATION AND LOGIN
          ====================================== */}

          <Route
            path="/lgu-register"
            element={<LGUSchoolRegister />}
          />

          <Route
            path="/lgu-login"
            element={<LGUSchoolLogin />}
          />

          {/* ======================================
              LGU / SCHOOL DASHBOARD
          ====================================== */}

          <Route
            path="/lgu-dashboard"
            element={<LGUSchoolDashboard />}
          />

          <Route
            path="/lgu-student-map"
            element={<StudentMap />}
          />

          {/* ======================================
              LGU / SCHOOL PROFILE
          ====================================== */}

          <Route
            path="/lgu-school-profile"
            element={<LGUSchoolProfile />}
          />

          <Route
            path="/lgu-organization-profile"
            element={
              <Navigate
                to="/lgu-school-profile"
                replace
              />
            }
          />

          {/* ======================================
              LGU / SCHOOL SCHOLARSHIP MANAGEMENT
          ====================================== */}

          <Route
            path="/lgu-scholarships"
            element={<ManageScholarships />}
          />

          <Route
            path="/lgu-create-scholarship"
            element={
              <Navigate
                to="/lgu-school-profile?createScholarship=1"
                replace
              />
            }
          />

          <Route
            path="/lgu-add-scholarship"
            element={
              <Navigate
                to="/lgu-school-profile?createScholarship=1"
                replace
              />
            }
          />

          {/* ======================================
              LGU / SCHOOL APPLICATIONS
          ====================================== */}

          <Route
            path="/lgu-applications"
            element={<Applications />}
          />

          {/* ======================================
              LGU / SCHOOL OTHER MENU ROUTES
          ====================================== */}

          <Route
            path="/lgu-requirements"
            element={
              <Navigate
                to="/lgu-dashboard"
                replace
              />
            }
          />

          <Route
            path="/lgu-messages"
            element={<LGUSchoolMessages />}
          />

          <Route
            path="/lgu-notifications"
            element={
              <Navigate
                to="/lgu-dashboard"
                replace
              />
            }
          />

          <Route
            path="/lgu-announcements"
            element={
              <Navigate
                to="/lgu-dashboard"
                replace
              />
            }
          />

          <Route
            path="/lgu-reports"
            element={
              <Navigate
                to="/lgu-dashboard"
                replace
              />
            }
          />

          <Route
            path="/lgu-settings"
            element={
              <Navigate
                to="/lgu-dashboard"
                replace
              />
            }
          />

          {/* ======================================
              ADMIN REGISTRATION AND LOGIN
          ====================================== */}

          <Route
            path="/admin-register"
            element={<RegisterAdmin />}
          />

          <Route
            path="/admin-login"
            element={<LoginAdmin />}
          />

          {/* ======================================
              ADMIN DASHBOARD
          ====================================== */}

          <Route
            path="/admin-dashboard"
            element={<AdminDashboard />}
          />

          {/* ======================================
              ADMIN MANAGEMENT PAGES
          ====================================== */}

          <Route
            path="/admin-students"
            element={<RegisteredStudents />}
          />

          <Route
            path="/admin-organizations"
            element={<LGUSchoolAccounts />}
          />

          <Route
            path="/admin-scholarships"
            element={<AdminScholarships />}
          />

          <Route
            path="/admin-applications"
            element={<AdminApplications />}
          />

          {/* ======================================
              ADMIN REPORTS
          ====================================== */}

          <Route
            path="/admin-reports"
            element={<AdminReports />}
          />

          {/* ======================================
              ADMIN NOTIFICATIONS
          ====================================== */}

          <Route
            path="/admin-notifications"
            element={<AdminNotifications />}
          />

          {/* ======================================
              ADMIN ACTIVITY LOGS
          ====================================== */}

          <Route
            path="/admin-activity-logs"
            element={<AdminActivityLogs />}
          />

          {/* ======================================
              STUDENT PAGES
          ====================================== */}

          <Route
            path="/student-dashboard"
            element={<StudentHome />}
          />

          {/* STUDENT LOCATION PAGE */}
          <Route
            path="/student-location"
            element={<StudentLocation />}
          />

          <Route
            path="/organization-profile/:organizationId"
            element={<OrganizationProfile />}
          />

          <Route
            path="/scholarships"
            element={<Scholarships />}
          />

          <Route
            path="/application-history"
            element={<ApplicationHistory />}
          />

          <Route
            path="/saved"
            element={<Saved />}
          />

          <Route
            path="/profile"
            element={<Profile />}
          />

          {/* ======================================
              STUDENT MESSAGING
          ====================================== */}

          <Route
            path="/student-messages"
            element={<Messages />}
          />

          <Route
            path="/messages"
            element={
              <Navigate
                to="/student-messages"
                replace
              />
            }
          />

          {/* ======================================
              STUDENT REDIRECTS
          ====================================== */}

          <Route
            path="/application"
            element={<StudentApplication />}
          />

          <Route
            path="/notifications"
            element={<StudentNotifications />}
          />

          <Route
            path="/scholarship-details/:id"
            element={
              <Navigate
                to="/scholarships"
                replace
              />
            }
          />

          {/* ======================================
              DEFAULT ROUTE
          ====================================== */}

          <Route
            path="/"
            element={
              <Navigate
                to="/register-choice"
                replace
              />
            }
          />

          {/* ======================================
              UNKNOWN ROUTES
          ====================================== */}

          <Route
            path="*"
            element={
              <Navigate
                to="/register-choice"
                replace
              />
            }
          />

        </IonRouterOutlet>
      </IonReactRouter>
    </IonApp>
  );
};

export default App;
