import AppInstallButton from '../../components/AppInstallButton';

import React from "react";
import {
  IonButton,
  IonContent,
  IonIcon,
  IonPage,
} from "@ionic/react";

import {
  schoolOutline,
  businessOutline,
  checkmarkCircleOutline,
  sparklesOutline,
  peopleOutline,
  shieldCheckmarkOutline,
} from "ionicons/icons";

import { useNavigate } from "react-router-dom";
import "./RegisterChoice.css";

const RegisterChoice: React.FC = () => {
  const navigate = useNavigate();

  const navigateAfterBlur = (path: string) => {
    const activeElement = document.activeElement;

    if (activeElement instanceof HTMLElement) {
      activeElement.blur();
    }

    navigate(path);
  };

  return (
    <IonPage className="register-choice-page">
      <IonContent fullscreen className="register-choice-content">
        <div className="register-choice-overlay">

          {/* HERO SECTION */}

          <section className="register-hero">
            <div className="hero-decoration hero-decoration-one" />
            <div className="hero-decoration hero-decoration-two" />
            <div className="hero-decoration hero-decoration-three" />

            <div className="hero-content">
              <div className="hero-brand">
                <img src="/mylogo.png" alt="GrantAccess Logo" />
                <span>
                  Grant<span className="brand-highlight">Access</span>
                </span>
              </div>

              <div className="hero-eyebrow">
                <IonIcon icon={sparklesOutline} />
                <span>OPPORTUNITIES BEGIN HERE</span>
              </div>

              <h1>
                Education opens doors.
                <br />
                <span>Let’s open yours.</span>
              </h1>

              <p className="hero-description">
                Your next opportunity starts with the right connection.
                Discover scholarship programs and bring students and
                educational institutions closer together with GrantAccess.
              </p>

              <AppInstallButton />

              <div className="hero-points">
                <div>
                  <span className="hero-check">
                    <IonIcon icon={checkmarkCircleOutline} />
                  </span>
                  <span>Discover scholarship opportunities</span>
                </div>

                <div>
                  <span className="hero-check">
                    <IonIcon icon={checkmarkCircleOutline} />
                  </span>
                  <span>Keep applications organized</span>
                </div>

                <div>
                  <span className="hero-check">
                    <IonIcon icon={checkmarkCircleOutline} />
                  </span>
                  <span>Connect students with institutions</span>
                </div>
              </div>
            </div>

            <div className="hero-bottom-label">
              <IonIcon icon={peopleOutline} />
              <span>CONNECTING STUDENTS WITH OPPORTUNITIES</span>
            </div>
          </section>

          {/* ACCOUNT SELECTION */}

          <main className="register-choice-container">
            <section className="welcome-section">
              <span className="section-eyebrow">GET STARTED</span>
              <h2>Choose your account</h2>
              <p>
                Select the account type that matches your role to continue.
              </p>

              <div className="welcome-divider">
                <span />
                <IonIcon icon={sparklesOutline} />
                <span />
              </div>
            </section>

            {/* ACCOUNT CARDS */}

            <section className="register-choice-options">

              {/* STUDENT CARD */}

              <article className="register-choice-card student-card">
                <div className="card-top">
                  <div className="choice-icon student-icon">
                    <IonIcon icon={schoolOutline} />
                  </div>
                  <span className="card-number">01 / STUDENT</span>
                </div>

                <span className="card-category">FOR STUDENTS</span>
                <h3>I'm a Student</h3>

                <p className="card-description">
                  Looking for financial assistance for your education?
                  Explore scholarship programs and manage your applications
                  in one convenient place.
                </p>

                <div className="card-divider" />

                <p className="feature-heading">
                  YOUR STUDENT ACCOUNT INCLUDES
                </p>

                <div className="card-features">
                  <div>
                    <IonIcon icon={checkmarkCircleOutline} />
                    <span>Browse available scholarships</span>
                  </div>
                  <div>
                    <IonIcon icon={checkmarkCircleOutline} />
                    <span>Check scholarship qualifications</span>
                  </div>
                  <div>
                    <IonIcon icon={checkmarkCircleOutline} />
                    <span>Submit and track applications</span>
                  </div>
                  <div>
                    <IonIcon icon={checkmarkCircleOutline} />
                    <span>Manage your student information</span>
                  </div>
                </div>

                <div className="card-action-buttons">
                  <IonButton
                    expand="block"
                    className="student-choice-button"
                    onClick={() => navigateAfterBlur("/student-register")}
                  >
                    Create Student Account
                  </IonButton>

                  <div className="login-prompt">
                    <span>Already have an account?</span>
                    <button
                      type="button"
                      className="text-login-button student-text-login"
                      onClick={() => navigateAfterBlur("/login")}
                    >
                      Log in
                    </button>
                  </div>
                </div>

                <p className="card-note">
                  Take the next step toward your educational goals.
                </p>
              </article>

              {/* LGU / SCHOOL CARD */}

              <article className="register-choice-card organization-card">
                <div className="card-top">
                  <div className="choice-icon organization-icon">
                    <IonIcon icon={businessOutline} />
                  </div>
                  <span className="card-number">02 / ORGANIZATION</span>
                </div>

                <span className="card-category">
                  FOR LGUs &amp; SCHOOLS
                </span>
                <h3>LGU / School Account</h3>

                <p className="card-description">
                  Represent an LGU or school offering scholarship
                  opportunities? Register your organization to publish
                  programs and manage student applications.
                </p>

                <div className="card-divider" />

                <p className="feature-heading">
                  YOUR ORGANIZATION ACCOUNT INCLUDES
                </p>

                <div className="card-features">
                  <div>
                    <IonIcon icon={checkmarkCircleOutline} />
                    <span>Publish scholarship opportunities</span>
                  </div>
                  <div>
                    <IonIcon icon={checkmarkCircleOutline} />
                    <span>Set requirements and deadlines</span>
                  </div>
                  <div>
                    <IonIcon icon={checkmarkCircleOutline} />
                    <span>Review student applications</span>
                  </div>
                  <div>
                    <IonIcon icon={checkmarkCircleOutline} />
                    <span>Manage scholarship program records</span>
                  </div>
                </div>

                <div className="card-action-buttons">
                  <IonButton
                    expand="block"
                    className="organization-choice-button"
                    onClick={() => navigateAfterBlur("/lgu-register")}
                  >
                    Create LGU / School Account
                  </IonButton>

                  <div className="login-prompt">
                    <span>Already have an account?</span>
                    <button
                      type="button"
                      className="text-login-button organization-text-login"
                      onClick={() => navigateAfterBlur("/lgu-login")}
                    >
                      Log in
                    </button>
                  </div>
                </div>

                <p className="card-note">
                  Help make educational support more accessible.
                </p>
              </article>

              {/* ADMIN CARD */}

              <article className="register-choice-card admin-card">
                <div className="card-top">
                  <div className="choice-icon admin-icon">
                    <IonIcon icon={shieldCheckmarkOutline} />
                  </div>
                  <span className="card-number">03 / ADMIN</span>
                </div>

                <span className="card-category">
                  FOR SYSTEM ADMINISTRATORS
                </span>
                <h3>Admin Account</h3>

                <p className="card-description">
                  Manage the GrantAccess platform, oversee user accounts,
                  monitor scholarship activities, and maintain organized
                  system records.
                </p>

                <div className="card-divider" />

                <p className="feature-heading">
                  YOUR ADMIN ACCOUNT INCLUDES
                </p>

                <div className="card-features">
                  <div>
                    <IonIcon icon={checkmarkCircleOutline} />
                    <span>Manage student and organization accounts</span>
                  </div>
                  <div>
                    <IonIcon icon={checkmarkCircleOutline} />
                    <span>Monitor scholarship listings</span>
                  </div>
                  <div>
                    <IonIcon icon={checkmarkCircleOutline} />
                    <span>Review LGU / School accounts</span>
                  </div>
                  <div>
                    <IonIcon icon={checkmarkCircleOutline} />
                    <span>Oversee system records and reports</span>
                  </div>
                </div>

                <div className="card-action-buttons">
                  <IonButton
                    expand="block"
                    className="admin-choice-button"
                    onClick={() => navigateAfterBlur("/admin-login")}
                  >
                    <IonIcon icon={peopleOutline} slot="start" />
                    Log in as Admin
                  </IonButton>


                </div>

                <p className="card-note">
                  Keeping scholarship opportunities organized and accessible.
                </p>
              </article>

            </section>

            {/* FOOTER */}

            <footer className="register-choice-footer">
              <div className="footer-brand">
                <img src="/mylogo.png" alt="" />
                <strong>GrantAccess</strong>
              </div>

              <p>
                Connecting students with scholarship opportunities.
              </p>

              <span>
                © {new Date().getFullYear()} GrantAccess. All rights reserved.
              </span>
            </footer>
          </main>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default RegisterChoice;
