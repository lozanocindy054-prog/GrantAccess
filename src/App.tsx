import AdminTabs from './components/AdminTabs';
import './theme/branding.css';
import OrganizationSettings from './lgu & school/OrganizationSettings/OrganizationSettings';
import OrganizationNotifications from './lgu & school/OrganizationNotifications/OrganizationNotifications';

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

import AdminAccessGate from './components/AdminAccessGate';
import AdminSettings from './Admin/AdminSettings/AdminSettings';
import EmailVerificationGate from './components/EmailVerificationGate';
import GlobalBackButton from './components/GlobalBackButton';

// ==========================================
// STUDENT REGISTRATION AND AUTHENTICATION
// ==========================================

import RegisterChoice from './pages/RegisterChoice/RegisterChoice';
import StudentRegister from './pages/StudentRegister/StudentRegister';
import LoginStudent from './pages/LoginStudent/LoginStudent';
import VerifyEmail from './pages/VerifyEmail/VerifyEmail';
import StoredFile from './pages/StoredFile/StoredFile';
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

// ==========================================
// LGU / SCHOOL PROFILE
// ==========================================

import LGUSchoolProfile from './lgu & school/LGUSchoolProfile/LGUSchoolProfile';

// ==========================================
// LGU / SCHOOL SCHOLARSHIP MANAGEMENT
// ==========================================

import ManageScholarships from './lgu & school/ManageScholarships/ManageScholarships';

// ==========================================
// LGU / SCHOOL APPLICATIONS AND MESSAGES
// ==========================================

import Applications from './lgu & school/Applications/Applications';
import LGUSchoolMessages from './lgu & school/Messages/Messages';

// ==========================================
// ADMIN REGISTRATION AND LOGIN
// ==========================================

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
// ADMIN REPORTS AND ACTIVITIES
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

// ==========================================
// IONIC CONFIGURATION
// ==========================================

setupIonicReact({
  mode: 'md',
});

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
        <AdminTabs />

        <IonRouterOutlet animated={false}>
          <Route path="/admin-settings" element={<AdminAccessGate><AdminSettings /></AdminAccessGate>} />
          <Route path="/verify-email" element={<EmailVerificationGate role="any" path="/verify-email" requireVerification={false}><VerifyEmail /></EmailVerificationGate>} />
          <Route path="/files/:fileId" element={<EmailVerificationGate role="any" path="/files/:fileId"><StoredFile /></EmailVerificationGate>} />

          {/* ==========================================
              REGISTRATION CHOICE
          ========================================== */}

          <Route
            path="/register-choice"
            element={<RegisterChoice />}
          />

          {/* ==========================================
              STUDENT REGISTRATION AND LOGIN
          ========================================== */}

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

          {/* ==========================================
              LGU / SCHOOL REGISTRATION AND LOGIN
          ========================================== */}

          <Route
            path="/lgu-register"
            element={<LGUSchoolRegister />}
          />

          <Route
            path="/lgu-login"
            element={<LGUSchoolLogin />}
          />

          {/* ==========================================
              LGU / SCHOOL DASHBOARD
          ========================================== */}

          <Route
            path="/lgu-dashboard"
            element={<EmailVerificationGate role="organization" path="/lgu-dashboard"><LGUSchoolDashboard /></EmailVerificationGate>}
          />

          <Route
            path="/lgu-student-map"
            element={<Navigate to="/lgu-dashboard" replace />}
          />

          {/* ==========================================
              LGU / SCHOOL PROFILE
          ========================================== */}

          <Route
            path="/lgu-school-profile"
            element={<EmailVerificationGate role="organization" path="/lgu-school-profile"><LGUSchoolProfile /></EmailVerificationGate>}
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

          {/* ==========================================
              LGU / SCHOOL SCHOLARSHIP MANAGEMENT
          ========================================== */}

          <Route
            path="/lgu-scholarships"
            element={<EmailVerificationGate role="organization" path="/lgu-scholarships"><ManageScholarships /></EmailVerificationGate>}
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

          {/* ==========================================
              LGU / SCHOOL APPLICATIONS AND MESSAGES
          ========================================== */}

          <Route
            path="/lgu-applications"
            element={<EmailVerificationGate role="organization" path="/lgu-applications"><Applications /></EmailVerificationGate>}
          />

          <Route
            path="/lgu-messages"
            element={<EmailVerificationGate role="organization" path="/lgu-messages"><LGUSchoolMessages /></EmailVerificationGate>}
          />

          {/* ==========================================
              LGU / SCHOOL OTHER MENU ROUTES
          ========================================== */}

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
            path="/lgu-notifications"
            element={<EmailVerificationGate role="organization" path="/lgu-notifications"><OrganizationNotifications /></EmailVerificationGate>}
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
            element={<EmailVerificationGate role="organization" path="/lgu-settings"><OrganizationSettings /></EmailVerificationGate>}
          />

          {/* ==========================================
              ADMIN REGISTRATION AND LOGIN
          ========================================== */}

          <Route
            path="/admin-register"
            element={<Navigate to="/admin-login" replace />}
          />

          <Route
            path="/admin-login"
            element={<LoginAdmin />}
          />

          {/* ==========================================
              ADMIN DASHBOARD
          ========================================== */}

          <Route
            path="/admin-dashboard"
            element={<AdminAccessGate><AdminDashboard /></AdminAccessGate>}
          />

          {/* ==========================================
              ADMIN MANAGEMENT PAGES
          ========================================== */}

          <Route
            path="/admin-students"
            element={<AdminAccessGate><RegisteredStudents /></AdminAccessGate>}
          />

          <Route
            path="/admin-organizations"
            element={<AdminAccessGate><LGUSchoolAccounts /></AdminAccessGate>}
          />

          <Route
            path="/admin-scholarships"
            element={<AdminAccessGate><AdminScholarships /></AdminAccessGate>}
          />

          <Route
            path="/admin-applications"
            element={<AdminAccessGate><AdminApplications /></AdminAccessGate>}
          />

          {/* ==========================================
              ADMIN REPORTS AND NOTIFICATIONS
          ========================================== */}

          <Route
            path="/admin-reports"
            element={<AdminAccessGate><AdminReports /></AdminAccessGate>}
          />

          <Route
            path="/admin-notifications"
            element={<AdminAccessGate><AdminNotifications /></AdminAccessGate>}
          />

          <Route
            path="/admin-activity-logs"
            element={<AdminAccessGate><AdminActivityLogs /></AdminAccessGate>}
          />

          {/* ==========================================
              STUDENT HOME / DASHBOARD
              MAIN STUDENT LANDING PAGE
          ========================================== */}

          <Route
            path="/student-dashboard"
            element={<EmailVerificationGate role="student" path="/student-dashboard"><StudentHome /></EmailVerificationGate>}
          />

          {/* STUDENT HOME ALIAS */}

          <Route
            path="/student-home"
            element={
              <Navigate
                to="/student-dashboard"
                replace
              />
            }
          />

          {/* ==========================================
              STUDENT LOCATION
          ========================================== */}

          <Route
            path="/student-location"
            element={<EmailVerificationGate role="student" path="/student-location"><StudentLocation /></EmailVerificationGate>}
          />

          {/* ==========================================
              ORGANIZATION PROFILE
          ========================================== */}

          <Route
            path="/organization-profile/:organizationId"
            element={<EmailVerificationGate role="student" path="/organization-profile/:organizationId"><OrganizationProfile /></EmailVerificationGate>}
          />

          {/* ==========================================
              STUDENT SCHOLARSHIPS
          ========================================== */}

          <Route
            path="/scholarships"
            element={<EmailVerificationGate role="student" path="/scholarships"><Scholarships /></EmailVerificationGate>}
          />

          {/* ==========================================
              STUDENT APPLICATION HISTORY
          ========================================== */}

          <Route
            path="/application-history"
            element={<EmailVerificationGate role="student" path="/application-history"><ApplicationHistory /></EmailVerificationGate>}
          />

          {/* ==========================================
              STUDENT SAVED ITEMS
          ========================================== */}

          <Route
            path="/saved"
            element={<EmailVerificationGate role="student" path="/saved"><Saved /></EmailVerificationGate>}
          />

          {/* ==========================================
              STUDENT PROFILE
          ========================================== */}

          <Route
            path="/profile"
            element={<EmailVerificationGate role="student" path="/profile"><Profile /></EmailVerificationGate>}
          />

          {/* ==========================================
              STUDENT MESSAGES
          ========================================== */}

          <Route
            path="/student-messages"
            element={<EmailVerificationGate role="student" path="/student-messages"><Messages /></EmailVerificationGate>}
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

          {/* ==========================================
              STUDENT APPLICATION
          ========================================== */}

          <Route
            path="/application"
            element={<EmailVerificationGate role="student" path="/application"><StudentApplication /></EmailVerificationGate>}
          />

          {/* ==========================================
              STUDENT NOTIFICATIONS
          ========================================== */}

          <Route
            path="/notifications"
            element={<EmailVerificationGate role="student" path="/notifications"><StudentNotifications /></EmailVerificationGate>}
          />

          {/* ==========================================
              SCHOLARSHIP DETAILS REDIRECT
          ========================================== */}

          <Route
            path="/scholarship-details/:id"
            element={
              <Navigate
                to="/scholarships"
                replace
              />
            }
          />

          {/* ==========================================
              ROOT ROUTE
              FIRST VISIT = REGISTRATION CHOICE
          ========================================== */}

          <Route
            path="/"
            element={
              <Navigate
                to="/register-choice"
                replace
              />
            }
          />

          {/* ==========================================
              UNKNOWN ROUTES
          ========================================== */}

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
