
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  IonPage,
  IonContent,
  IonButton,
  IonIcon,
  IonInput,
  IonSpinner,
  IonToast,
  IonModal,
} from '@ionic/react';

import {
  searchOutline,
  refreshOutline,
  eyeOutline,
  peopleOutline,
  closeOutline,
} from 'ionicons/icons';

import { collection, getDocs, onSnapshot, type QuerySnapshot, type DocumentData } from 'firebase/firestore';
import { db } from '../../Firebase/config';

import './RegisteredStudents.css';

interface Student {
  id: string;
  studentId: string;
  name: string;
  email: string;
  course: string;
  status: string;
  rawData: Record<string, unknown>;
}

const RegisteredStudents: React.FC = () => {
  const navigate = useNavigate();

  const [students, setStudents] = useState<Student[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedStudent, setSelectedStudent] =
    useState<Student | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showToast, setShowToast] = useState(false);

  const loadStudents = useCallback(async (incoming?: QuerySnapshot<DocumentData>) => {
    setLoading(true);
    setErrorMessage('');

    try {
      const snapshot = incoming ?? await getDocs(collection(db, 'students'));

      const studentList: Student[] = snapshot.docs.map(
        (document, index) => {
          const data = document.data();

          const fullName =
            data.fullName ||
            data.name ||
            [
              data.firstName,
              data.middleName,
              data.lastName,
            ]
              .filter(Boolean)
              .join(' ');

          return {
            id: document.id,
            studentId: String(
              data.studentId ||
                data.studentID ||
                data.studentNumber ||
                `STU-${String(index + 1).padStart(3, '0')}`
            ),
            name: String(fullName || 'No name provided'),
            email: String(
              data.email || data.emailAddress || 'No email provided'
            ),
            course: String(
              data.course ||
                data.program ||
                data.degree ||
                'Not specified'
            ),
            status: String(data.status || 'Active'),
            rawData: data,
          };
        }
      );

      setStudents(studentList);
    } catch (error) {
      console.error('Error loading students:', error);

      setErrorMessage(
        'Unable to load students. Please check your Firebase connection and Firestore permissions.'
      );
      setShowToast(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => onSnapshot(collection(db, 'students'), snapshot => {
    void loadStudents(snapshot);
  }, () => {
    setLoading(false); setErrorMessage('Unable to load students. Please check your connection.'); setShowToast(true);
  }), [loadStudents]);

  const filteredStudents = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    if (!search) return students;

    return students.filter((student) =>
      [
        student.studentId,
        student.name,
        student.email,
        student.course,
        student.status,
      ].some((value) => value.toLowerCase().includes(search))
    );
  }, [students, searchTerm]);

  const openStudentDetails = (student: Student) => {
    setSelectedStudent(student);
    setShowDetails(true);
  };

  const closeStudentDetails = () => {
    setShowDetails(false);
    setSelectedStudent(null);
  };

  return (
    <IonPage>
      <IonContent
        fullscreen
        className="registered-students-content"
      >
        <div className="registered-students-page">

          {/* HEADER WITH LOGO AND REFRESH */}
          <header className="students-brand-header">
            <div className="students-brand">
              <img
                src="/mylogo.png"
                alt="GrantAccess Logo"
                className="students-brand-logo"
              />

              <div className="students-brand-text">
                <h2>GrantAccess</h2>
                <p>ADMIN PORTAL</p>
              </div>
            </div>

            <IonButton
              className="students-refresh-button"
              onClick={() => void loadStudents()}
              disabled={loading}
            >
              <IonIcon icon={refreshOutline} slot="start" />
              Refresh
            </IonButton>
          </header>

          {/* PAGE TITLE */}
          <section className="students-page-heading">
            <p className="students-eyebrow">STUDENT MANAGEMENT</p>
            <h1>Registered Students</h1>
            <p className="students-subtitle">
              View and manage student accounts registered in GrantAccess.
            </p>
          </section>

          {/* TOTAL STUDENTS */}
          <section className="students-summary-card">
            <div className="students-summary-icon">
              <IonIcon icon={peopleOutline} />
            </div>

            <div>
              <p>Total Registered Students</p>
              <h2>{loading ? '...' : students.length}</h2>
            </div>
          </section>

          {/* STUDENT TABLE */}
          <section className="students-table-card">
            <div className="students-table-heading">
              <div>
                <h2>Student List</h2>
                <p>Search and view student information.</p>
              </div>

              <div className="students-search">
                <IonIcon icon={searchOutline} />

                <IonInput
                  value={searchTerm}
                  placeholder="Search students..."
                  clearInput
                  onIonInput={(event) =>
                    setSearchTerm(event.detail.value ?? '')
                  }
                />
              </div>
            </div>

            {loading ? (
              <div className="students-state">
                <IonSpinner name="crescent" />
                <p>Loading students...</p>
              </div>
            ) : errorMessage ? (
              <div className="students-state">
                <h3>Unable to load students</h3>
                <p>{errorMessage}</p>

                <IonButton onClick={() => void loadStudents()}>
                  Try Again
                </IonButton>
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="students-state">
                <IonIcon icon={peopleOutline} />

                <h3>
                  {students.length === 0
                    ? 'No registered students yet'
                    : 'No matching students found'}
                </h3>

                <p>
                  {students.length === 0
                    ? 'Student records saved in Firestore will appear here.'
                    : 'Try another name, email, student ID, or course.'}
                </p>
              </div>
            ) : (
              <div className="students-table-wrapper">
                <table className="students-table">
                  <thead>
                    <tr>
                      <th>Student ID</th>
                      <th>Student Name</th>
                      <th>Email Address</th>
                      <th>Course / Program</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredStudents.map((student) => (
                      <tr key={student.id}>
                        <td>{student.studentId}</td>

                        <td className="students-name-cell">
                          {student.name}
                        </td>

                        <td>{student.email}</td>
                        <td>{student.course}</td>

                        <td>
                          <span
                            className={`student-status ${
                              student.status.toLowerCase() === 'active'
                                ? 'student-status-active'
                                : 'student-status-other'
                            }`}
                          >
                            {student.status}
                          </span>
                        </td>

                        <td>
                          <button
                            type="button"
                            className="student-view-button"
                            onClick={() => openStudentDetails(student)}
                          >
                            <IonIcon icon={eyeOutline} />
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {!loading && !errorMessage && students.length > 0 && (
              <div className="students-table-footer">
                Showing {filteredStudents.length} of {students.length} students
              </div>
            )}
          </section>

          {/* BACK BUTTON */}
          <div className="students-bottom-actions">
            <button
              type="button"
              className="students-back-button"
              onClick={() => navigate('/admin-dashboard')}
            >
              
              <span>Back</span>
            </button>
          </div>
        </div>

        {/* STUDENT DETAILS MODAL */}
        <IonModal
          isOpen={showDetails}
          onDidDismiss={closeStudentDetails}
          className="student-details-modal"
        >
          <div className="student-modal-content">
            <div className="student-modal-header">
              <div className="student-modal-brand">
                <img
                  src="/mylogo.png"
                  alt="GrantAccess Logo"
                  className="student-modal-logo"
                />

                <div>
                  <p className="students-eyebrow">GRANTACCESS</p>
                  <h2>Student Details</h2>
                </div>
              </div>

              <button
                type="button"
                className="student-modal-close"
                onClick={closeStudentDetails}
                aria-label="Close student details"
              >
                <IonIcon icon={closeOutline} />
              </button>
            </div>

            {selectedStudent && (
              <>
                <div className="student-modal-profile">
                  <div className="student-modal-avatar">
                    <IonIcon icon={peopleOutline} />
                  </div>

                  <div>
                    <h3>{selectedStudent.name}</h3>
                    <p>{selectedStudent.studentId}</p>
                  </div>
                </div>

                <div className="student-details-list">
                  <div className="student-detail-item">
                    <span>Email Address</span>
                    <strong>{selectedStudent.email}</strong>
                  </div>

                  <div className="student-detail-item">
                    <span>Course / Program</span>
                    <strong>{selectedStudent.course}</strong>
                  </div>

                  <div className="student-detail-item">
                    <span>Account Status</span>
                    <strong>{selectedStudent.status}</strong>
                  </div>

                  {Object.entries(selectedStudent.rawData)
                    .filter(([key, value]) => {
                      const hiddenKeys = [
                        'password',
                        'confirmPassword',
                        'uid',
                        'email',
                        'emailAddress',
                        'fullName',
                        'name',
                        'firstName',
                        'middleName',
                        'lastName',
                        'studentId',
                        'studentID',
                        'studentNumber',
                        'course',
                        'program',
                        'degree',
                        'status',
                      ];

                      return (
                        !hiddenKeys.includes(key) &&
                        (typeof value === 'string' ||
                          typeof value === 'number' ||
                          typeof value === 'boolean')
                      );
                    })
                    .map(([key, value]) => (
                      <div className="student-detail-item" key={key}>
                        <span>{key.replace(/([A-Z])/g, ' $1')}</span>
                        <strong>{String(value)}</strong>
                      </div>
                    ))}
                </div>

                <IonButton
                  expand="block"
                  className="student-modal-done-button"
                  onClick={closeStudentDetails}
                >
                  Close
                </IonButton>
              </>
            )}
          </div>
        </IonModal>

        <IonToast
          isOpen={showToast}
          message={errorMessage}
          duration={4000}
          color="danger"
          onDidDismiss={() => setShowToast(false)}
        />
      </IonContent>
    </IonPage>
  );
};

export default RegisteredStudents;
