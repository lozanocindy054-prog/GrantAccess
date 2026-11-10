import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IonButton,
  IonContent,
  IonIcon,
  IonPage,
  IonSearchbar,
  IonSpinner,
  useIonViewDidEnter,
} from '@ionic/react';
import {
  arrowBackOutline,
  locationOutline,
  peopleOutline,
  shieldCheckmarkOutline,
} from 'ionicons/icons';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  type DocumentData,
} from 'firebase/firestore';
import { auth, db } from '../../Firebase/config';
import './StudentMap.css';

interface SharedStudentLocation {
  id: string;
  name: string;
  scholarshipTitle: string;
  latitude: number;
  longitude: number;
}

interface MapPoint {
  latitude: number;
  longitude: number;
}

const DEFAULT_CENTER: L.LatLngExpression = [12.8797, 121.774];

const readPoint = (value: unknown): MapPoint | null => {
  if (!value || typeof value !== 'object') return null;

  const coordinates = value as Record<string, unknown>;

  // Accept numbers and numeric strings (some documents save "13.41")
  const latitude = Number(coordinates.latitude);
  const longitude = Number(coordinates.longitude);

  if (
    coordinates.latitude === null ||
    coordinates.latitude === undefined ||
    coordinates.latitude === '' ||
    coordinates.longitude === null ||
    coordinates.longitude === undefined ||
    coordinates.longitude === '' ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }

  return { latitude, longitude };
};

const StudentMap: React.FC = () => {
  const navigate = useNavigate();
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const studentMarkersRef = useRef<Map<string, L.CircleMarker>>(new Map());
  const organizationMarkerRef = useRef<L.CircleMarker | null>(null);
  const fitKeyRef = useRef('');
  const [students, setStudents] = useState<SharedStudentLocation[]>([]);
  const [organizationLocation, setOrganizationLocation] =
    useState<MapPoint | null>(null);
  const [organizationLoaded, setOrganizationLoaded] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const filteredStudents = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return students;
    return students.filter((student) =>
      `${student.name} ${student.scholarshipTitle}`
        .toLowerCase()
        .includes(term)
    );
  }, [search, students]);

  // ------------------------------------------------------
  // FIREBASE LISTENERS
  // ------------------------------------------------------

  useEffect(() => {
    let unsubscribeApplications: (() => void) | undefined;
    let unsubscribeOrganization: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      unsubscribeApplications?.();
      unsubscribeOrganization?.();
      unsubscribeApplications = undefined;
      unsubscribeOrganization = undefined;
      setStudents([]);
      setOrganizationLocation(null);
      setOrganizationLoaded(false);

      if (!user) {
        setLoading(false);
        navigate('/lgu-login', { replace: true });
        return;
      }

      setLoading(true);
      setErrorMessage('');

      unsubscribeApplications = onSnapshot(
        query(
          collection(db, 'applications'),
          where('organizationId', '==', user.uid)
        ),
        (snapshot) => {
          const uniqueStudents = new Map<string, SharedStudentLocation>();

          snapshot.docs.forEach((application) => {
            const data = application.data() as DocumentData;
            if (data.locationConsent !== true) return;

            const point = readPoint(data.approximateLocation);
            const studentId = String(data.studentId ?? data.userId ?? '');
            if (!point || !studentId || uniqueStudents.has(studentId)) return;

            uniqueStudents.set(studentId, {
              id: studentId,
              name: String(data.studentName ?? data.fullName ?? 'Student'),
              scholarshipTitle: String(
                data.scholarshipTitle ?? 'Scholarship application'
              ),
              ...point,
            });
          });

          const nextStudents = Array.from(uniqueStudents.values()).sort(
            (first, second) => first.name.localeCompare(second.name)
          );
          setStudents(nextStudents);
          setSelectedStudentId((current) =>
            nextStudents.some((student) => student.id === current)
              ? current
              : ''
          );
          setLoading(false);
          setErrorMessage('');
        },
        (error) => {
          console.error('Unable to load applicant locations:', error);
          setLoading(false);
          setErrorMessage(
            error.code === 'permission-denied'
              ? 'Firestore rules do not allow this organization to read its applications.'
              : 'Unable to load student locations right now. Please try again later.'
          );
        }
      );

      unsubscribeOrganization = onSnapshot(
        doc(db, 'organizations', user.uid),
        (snapshot) => {
          const data = snapshot.data();
          setOrganizationLocation(
            data
              ? readPoint({
                  latitude:
                    data.latitude ?? data.lat ?? data.coordinates?.latitude,
                  longitude:
                    data.longitude ?? data.lng ?? data.coordinates?.longitude,
                })
              : null
          );
          setOrganizationLoaded(true);
        },
        (error) => {
          console.error('Unable to load organization map pin:', error);
          setOrganizationLoaded(true);
        }
      );
    });

    return () => {
      unsubscribeAuth();
      unsubscribeApplications?.();
      unsubscribeOrganization?.();
    };
  }, [navigate]);

  // ------------------------------------------------------
  // MAP SETUP (runs once)
  // ------------------------------------------------------

  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container || mapRef.current) return;

    const studentMarkers = studentMarkersRef.current;
    const map = L.map(container, {
      zoomControl: true,
      scrollWheelZoom: true,
    }).setView(DEFAULT_CENTER, 5);

    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
      {
        attribution:
          'Tiles &copy; <a href="https://www.esri.com/">Esri</a> | Sources: Esri, HERE, Garmin, USGS, Intermap, INCREMENT P, NRCan, Esri Japan, METI, Esri China (Hong Kong), Esri Korea, Esri (Thailand), NGCC, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
        maxZoom: 19,
      }
    ).addTo(map);

    mapRef.current = map;
    fitKeyRef.current = '';
    const frame = window.requestAnimationFrame(() =>
      map.invalidateSize({ animate: false })
    );

    return () => {
      window.cancelAnimationFrame(frame);
      studentMarkers.forEach((marker) => marker.remove());
      studentMarkers.clear();
      organizationMarkerRef.current?.remove();
      organizationMarkerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const refreshMap = useCallback(() => {
    window.requestAnimationFrame(() =>
      mapRef.current?.invalidateSize({ animate: false })
    );
    window.setTimeout(
      () => mapRef.current?.invalidateSize({ animate: false }),
      250
    );
  }, []);

  useIonViewDidEnter(refreshMap, [refreshMap]);

  // ------------------------------------------------------
  // DRAW MARKERS (does NOT move the map)
  // ------------------------------------------------------

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    studentMarkersRef.current.forEach((marker) => marker.remove());
    studentMarkersRef.current.clear();
    organizationMarkerRef.current?.remove();
    organizationMarkerRef.current = null;

    if (organizationLocation) {
      organizationMarkerRef.current = L.circleMarker(
        [organizationLocation.latitude, organizationLocation.longitude],
        {
          radius: 11,
          color: '#ffffff',
          weight: 3,
          fillColor: '#174f2a',
          fillOpacity: 1,
        }
      )
        .addTo(map)
        .bindPopup('Your organization location');
    }

    filteredStudents.forEach((student) => {
      const marker = L.circleMarker([student.latitude, student.longitude], {
        radius: selectedStudentId === student.id ? 10 : 8,
        color: '#ffffff',
        weight: 3,
        fillColor: selectedStudentId === student.id ? '#1d5fc4' : '#4384dd',
        fillOpacity: 1,
      }).addTo(map);

      const popup = document.createElement('div');
      popup.className = 'lgu-student-map-popup';
      const name = document.createElement('strong');
      name.textContent = student.name;
      const scholarship = document.createElement('span');
      scholarship.textContent = student.scholarshipTitle;
      const note = document.createElement('small');
      note.textContent = 'Approximate location shared by the student';
      popup.append(name, scholarship, note);
      marker.bindPopup(popup);
      marker.on('click', () => setSelectedStudentId(student.id));
      studentMarkersRef.current.set(student.id, marker);
    });
  }, [filteredStudents, organizationLocation, selectedStudentId]);

  // ------------------------------------------------------
  // FIT THE MAP only when the set of pins changes
  // (typing in the search box no longer makes the map jump)
  // ------------------------------------------------------

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const key = `${students.map((student) => student.id).join(',')}|${
      organizationLocation
        ? `${organizationLocation.latitude},${organizationLocation.longitude}`
        : ''
    }`;

    if (key === fitKeyRef.current) return;
    fitKeyRef.current = key;

    const allMarkers = [
      ...studentMarkersRef.current.values(),
      ...(organizationMarkerRef.current ? [organizationMarkerRef.current] : []),
    ];

    if (allMarkers.length > 1) {
      map.fitBounds(L.featureGroup(allMarkers).getBounds(), {
        padding: [40, 40],
        maxZoom: 12,
      });
    } else if (allMarkers.length === 1) {
      map.setView(allMarkers[0].getLatLng(), 12);
    } else {
      map.setView(DEFAULT_CENTER, 5);
    }

    refreshMap();
  }, [students, organizationLocation, refreshMap]);

  // ------------------------------------------------------
  // FOCUS the selected student (only when the selection changes)
  // ------------------------------------------------------

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedStudentId) return;

    const selectedMarker = studentMarkersRef.current.get(selectedStudentId);
    if (!selectedMarker) return;

    map.setView(selectedMarker.getLatLng(), 12, { animate: true });
    selectedMarker.openPopup();
  }, [selectedStudentId]);

  return (
    <IonPage className="lgu-student-map-page">
      <IonContent fullscreen>
        <main className="lgu-student-map-layout">
          <header className="lgu-student-map-header">
            <IonButton
              fill="clear"
              onClick={() => navigate('/lgu-dashboard')}
              aria-label="Back to organization dashboard"
            >
              <IonIcon icon={arrowBackOutline} />
            </IonButton>
            <div className="lgu-student-map-title">
              <span className="lgu-student-map-title-icon">
                <IonIcon icon={locationOutline} />
              </span>
              <div>
                <h1>Student Map</h1>
                <p>Approximate locations shared with your organization</p>
              </div>
            </div>
            <span className="lgu-student-map-count">
              <IonIcon icon={peopleOutline} />
              {filteredStudents.length}
            </span>
          </header>

          <section className="lgu-student-map-privacy" role="note">
            <IonIcon icon={shieldCheckmarkOutline} />
            <p>
              Only students who applied to your organization and chose to share
              their approximate location are shown. Pins are approximate, not
              exact addresses.
            </p>
          </section>

          {organizationLoaded && !organizationLocation && (
            <section className="lgu-student-map-privacy" role="alert">
              <IonIcon icon={locationOutline} />
              <p>
                Your organization map pin is not set yet, so students cannot
                find your location. Set it in your organization profile.
              </p>
              <IonButton
                size="small"
                onClick={() => navigate('/lgu-school-profile')}
              >
                Set pin
              </IonButton>
            </section>
          )}

          <div className="lgu-student-map-content">
            <section className="lgu-student-map-list-panel">
              <h2>Applicants who shared location</h2>
              <IonSearchbar
                value={search}
                onIonInput={(event) => setSearch(event.detail.value || '')}
                placeholder="Search students or scholarships"
                aria-label="Search students or scholarships"
                debounce={150}
              />
              <div className="lgu-student-map-list">
                {loading ? (
                  <div className="lgu-student-map-state">
                    <IonSpinner name="crescent" />
                    <span>Loading shared locations...</span>
                  </div>
                ) : errorMessage ? (
                  <div className="lgu-student-map-state error" role="alert">
                    {errorMessage}
                  </div>
                ) : filteredStudents.length ? (
                  filteredStudents.map((student) => (
                    <button
                      type="button"
                      className={`lgu-student-map-row ${
                        selectedStudentId === student.id ? 'selected' : ''
                      }`}
                      key={student.id}
                      onClick={() => setSelectedStudentId(student.id)}
                    >
                      <span className="lgu-student-map-avatar">
                        {student.name.charAt(0).toUpperCase()}
                      </span>
                      <span className="lgu-student-map-row-copy">
                        <strong>{student.name}</strong>
                        <small>{student.scholarshipTitle}</small>
                      </span>
                      <IonIcon icon={locationOutline} />
                    </button>
                  ))
                ) : (
                  <div className="lgu-student-map-state">
                    {search
                      ? 'No applicants match your search.'
                      : 'No applicants have shared their approximate location yet.'}
                  </div>
                )}
              </div>
            </section>

            <section className="lgu-student-map-canvas-panel">
              <div
                ref={mapContainerRef}
                className="lgu-student-map-canvas"
                aria-label="Map of applicants who shared approximate locations"
              />
              <div className="lgu-student-map-legend">
                <span><i className="student-dot" /> Student approximate location</span>
                <span><i className="organization-dot" /> Your organization pin</span>
              </div>
            </section>
          </div>
        </main>
      </IonContent>
    </IonPage>
  );
};

export default StudentMap;