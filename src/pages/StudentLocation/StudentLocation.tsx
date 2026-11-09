
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';

import {
  IonPage,
  IonContent,
  IonButton,
  IonIcon,
  IonToast,
  IonSpinner,
  IonSearchbar,
  useIonViewDidEnter,
} from '@ionic/react';

import {
  businessOutline,
  locationOutline,
  shieldCheckmarkOutline,
  eyeOffOutline,
  informationCircleOutline,
  navigateOutline,
  arrowBackOutline,
  refreshOutline,
  chevronDownOutline,
  chevronUpOutline,
} from 'ionicons/icons';

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  onSnapshot,
  type DocumentData,
} from 'firebase/firestore';
import { auth, db } from '../../Firebase/config';

import './StudentLocation.css';

interface ApproximateLocation {
  latitude: number;
  longitude: number;
}

interface Organization {
  id: string;
  name: string;
  type: string;
  address: string;
  description: string;
  logo: string;
  status: string;
  latitude?: number;
  longitude?: number;
  lat?: number;
  lng?: number;
}

interface GeocodingResult {
  lat: string;
  lon: string;
}

const DEFAULT_CENTER: L.LatLngExpression = [12.8797, 121.774];

const StudentLocation: React.FC = () => {
  const navigate = useNavigate();

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markerRef = useRef<L.CircleMarker | null>(null);
  const accuracyCircleRef = useRef<L.Circle | null>(null);
  const organizationMarkersRef = useRef<Map<string, L.Marker>>(new Map());

  const [sharingEnabled, setSharingEnabled] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const [location, setLocation] =
    useState<ApproximateLocation | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState('');
  const [organizationSearch, setOrganizationSearch] = useState('');
  const [organizationSheetExpanded, setOrganizationSheetExpanded] =
    useState(false);
  const [organizationLocations, setOrganizationLocations] = useState<
    Record<string, ApproximateLocation>
  >({});
  const [organizationMapStatus, setOrganizationMapStatus] = useState(
    'Choose an organization to see its location.'
  );
  const [organizationLoading, setOrganizationLoading] = useState(true);
  const [organizationError, setOrganizationError] = useState('');

  const [loading, setLoading] = useState(false);
  const [mapLoading, setMapLoading] = useState(true);
  const [mapError, setMapError] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  const organizationsWithLocations = useMemo(
    () =>
      organizations.filter(
        (organization) =>
          (organization.address.trim() ||
            (typeof organization.latitude === 'number' &&
              typeof organization.longitude === 'number') ||
            (typeof organization.lat === 'number' &&
              typeof organization.lng === 'number'))
      ),
    [organizations]
  );
  const selectedOrganization = useMemo(
    () =>
      organizationsWithLocations.find(
        (organization) => organization.id === selectedOrganizationId
      ) || organizationsWithLocations[0],
    [organizationsWithLocations, selectedOrganizationId]
  );
  const selectedOrganizationRef = useRef<Organization | undefined>(
    selectedOrganization
  );
  selectedOrganizationRef.current = selectedOrganization;
  const filteredOrganizations = useMemo(
    () =>
      organizationsWithLocations.filter((organization) =>
        `${organization.name} ${organization.address} ${organization.type}`
          .toLowerCase()
          .includes(organizationSearch.trim().toLowerCase())
      ),
    [organizationSearch, organizationsWithLocations]
  );

  const goBackHome = () => {
    navigate('/student-dashboard');
  };

  // Round coordinates before displaying them in the preview.
  const roundCoordinates = (
    latitude: number,
    longitude: number
  ): ApproximateLocation => ({
    latitude: Number(latitude.toFixed(2)),
    longitude: Number(longitude.toFixed(2)),
  });

  useEffect(() => {
    let unsubscribeOrganizations: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      unsubscribeOrganizations?.();
      unsubscribeOrganizations = undefined;
      setOrganizations([]);
      setSelectedOrganizationId('');

      if (!user) {
        setOrganizationError(
          'Please sign in to view organization locations.'
        );
        setOrganizationLoading(false);
        return;
      }

      setOrganizationLoading(true);
      setOrganizationError('');

      unsubscribeOrganizations = onSnapshot(
        collection(db, 'organizations'),
        (snapshot) => {
          const data = snapshot.docs.map((item) => {
            const value = item.data() as DocumentData;
            const coordinateData = value.coordinates || {};
            const latitude = Number(
              value.latitude ??
                value.lat ??
                coordinateData.latitude ??
                coordinateData.lat
            );
            const longitude = Number(
              value.longitude ??
                value.lng ??
                coordinateData.longitude ??
                coordinateData.lng
            );

            return {
              id: item.id,
              name:
                value.organizationName ||
                value.name ||
                'Participating Organization',
              type: value.organizationType || value.type || '',
              address:
                value.address ||
                value.location ||
                value.organizationAddress ||
                '',
              description: value.description || '',
              logo: value.logoUrl || value.logo || '',
              status:
                typeof value.status === 'string'
                  ? value.status.toLowerCase()
                  : '',
              ...(Number.isFinite(latitude) &&
              latitude >= -90 &&
              latitude <= 90
                ? { latitude }
                : {}),
              ...(Number.isFinite(longitude) &&
              longitude >= -180 &&
              longitude <= 180
                ? { longitude }
                : {}),
            } satisfies Organization;
          });

          const available = data.filter(
            (organization) =>
              organization.address.trim() ||
              (typeof organization.latitude === 'number' &&
                typeof organization.longitude === 'number')
          );

          setOrganizations(data);
          setSelectedOrganizationId((current) =>
            available.some((organization) => organization.id === current)
              ? current
              : available[0]?.id || ''
          );
          setOrganizationLoading(false);
          setOrganizationError('');
        },
        (error) => {
          console.error('Unable to load organization locations:', error);
          setOrganizationError(
            error.code === 'permission-denied'
              ? 'Firestore rules are blocking access to organization locations. Allow signed-in students to read organization names, addresses, logos, and map coordinates.'
              : 'Organization locations could not be loaded. Please try again later.'
          );
          setOrganizationLoading(false);
        }
      );
    });

    return () => {
      unsubscribeAuth();
      unsubscribeOrganizations?.();
    };
  }, []);

  // Initialize Leaflet map once.
  useEffect(() => {
    const organizationMarkers = organizationMarkersRef.current;
    const container = mapContainerRef.current;

    if (!container || mapRef.current) return;

    const map = L.map(container, {
      zoomControl: true,
      scrollWheelZoom: true,
      attributionControl: true,
    }).setView(DEFAULT_CENTER, 5);

    const tileLayer = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
      {
        attribution:
          'Tiles &copy; <a href="https://www.esri.com/">Esri</a> | Sources: Esri, HERE, Garmin, USGS, Intermap, INCREMENT P, NRCan, Esri Japan, METI, Esri China (Hong Kong), Esri Korea, Esri (Thailand), NGCC, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>, and the GIS User Community',
        maxZoom: 19,
      }
    );

    tileLayer.on('loading', () => {
      setMapLoading(true);
      setMapError('');
    });

    tileLayer.on('load', () => {
      setMapLoading(false);
      setMapError('');
    });

    tileLayer.on('tileerror', () => {
      setMapLoading(false);
      setMapError(
        'Map tiles could not be loaded. Please check your internet connection.'
      );
    });

    tileLayer.addTo(map);

    mapRef.current = map;
    tileLayerRef.current = tileLayer;

    const resizeObserver =
      typeof ResizeObserver === 'undefined'
        ? undefined
        : new ResizeObserver(() => {
            if (
              mapRef.current === map &&
              container.isConnected &&
              map.getPane('mapPane')
            ) {
              map.invalidateSize({ animate: false });
            }
          });
    resizeObserver?.observe(container);
    const frame = window.requestAnimationFrame(() => {
      if (mapRef.current === map && map.getPane('mapPane')) {
        map.invalidateSize({ animate: false });
      }
    });
    const resizeTimeout = window.setTimeout(
      () => {
        if (mapRef.current === map && map.getPane('mapPane')) {
          map.invalidateSize({ animate: false });
        }
      },
      300
    );

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(resizeTimeout);
      resizeObserver?.disconnect();
      map.remove();

      mapRef.current = null;
      tileLayerRef.current = null;
      markerRef.current = null;
      accuracyCircleRef.current = null;
      organizationMarkers.forEach((marker) => marker.remove());
      organizationMarkers.clear();
    };
  }, []);

  useEffect(() => {
    const organization = selectedOrganization;
    if (!organization) {
      setOrganizationMapStatus(
        organizationLoading
          ? 'Loading organization locations...'
          : 'No organization locations are available yet. An LGU/School account must save its address or map pin.'
      );
      return;
    }

    const latitude = organization.latitude ?? organization.lat;
    const longitude = organization.longitude ?? organization.lng;

    if (
      typeof latitude === 'number' &&
      typeof longitude === 'number' &&
      Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      latitude >= -90 &&
      latitude <= 90 &&
      longitude >= -180 &&
      longitude <= 180
    ) {
      setOrganizationLocations((current) => ({
        ...current,
        [organization.id]: { latitude, longitude },
      }));
      setOrganizationMapStatus(
        `${organization.name} location is shown on the map.`
      );
      return;
    }

    if (
      !organization.address ||
      organizationLocations[organization.id]
    ) {
      return;
    }

    const controller = new AbortController();
    setOrganizationMapStatus(`Finding ${organization.name} on the map...`);

    const query = [
      organization.name,
      organization.address,
      'Philippines',
    ]
      .filter(Boolean)
      .join(', ');

    void fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=ph&q=${encodeURIComponent(
        query
      )}`,
      { signal: controller.signal }
    )
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(
            `Organization geocoding failed with status ${response.status}.`
          );
        }

        return (await response.json()) as GeocodingResult[];
      })
      .then((results) => {
        if (controller.signal.aborted) return;

        const latitude = Number(results[0]?.lat);
        const longitude = Number(results[0]?.lon);

        if (
          !results[0] ||
          !Number.isFinite(latitude) ||
          !Number.isFinite(longitude)
        ) {
          setOrganizationMapStatus(
            `Could not find ${organization.name}'s address on the map.`
          );
          return;
        }

        setOrganizationLocations((current) => ({
          ...current,
          [organization.id]: { latitude, longitude },
        }));
        setOrganizationMapStatus(
          `${organization.name} location is shown on the map.`
        );
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;

        console.error('Unable to find organization on map:', error);
        setOrganizationMapStatus(
          `Unable to load ${organization.name}'s map location.`
        );
      });

    return () => controller.abort();
  }, [organizationLoading, organizationLocations, selectedOrganization]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    organizationMarkersRef.current.forEach((marker) => marker.remove());
    organizationMarkersRef.current.clear();

    organizationsWithLocations.forEach((organization) => {
      const coordinates =
        organizationLocations[organization.id] ||
        (typeof (organization.latitude ?? organization.lat) === 'number' &&
        typeof (organization.longitude ?? organization.lng) === 'number'
          ? {
              latitude: organization.latitude ?? organization.lat ?? 0,
              longitude: organization.longitude ?? organization.lng ?? 0,
            }
          : undefined);

      if (!coordinates) return;

      const markerContent = document.createElement('div');
      markerContent.className = 'organization-map-marker-content';

      if (organization.logo) {
        const image = document.createElement('img');
        image.src = organization.logo;
        image.alt = '';
        markerContent.appendChild(image);
      } else {
        const placeholder = document.createElement('span');
        placeholder.textContent = organization.name.charAt(0).toUpperCase();
        markerContent.appendChild(placeholder);
      }

      const marker = L.marker(
        [coordinates.latitude, coordinates.longitude],
        {
          icon: L.divIcon({
            className: `organization-map-marker ${
              selectedOrganization?.id === organization.id ? 'selected' : ''
            }`,
            html: markerContent,
            iconSize: [48, 48],
            iconAnchor: [24, 24],
          }),
        }
      ).addTo(map);

      const popup = document.createElement('div');
      popup.className = 'organization-map-popup';

      const name = document.createElement('strong');
      name.textContent = organization.name;
      popup.appendChild(name);

      if (organization.type) {
        const type = document.createElement('span');
        type.textContent = organization.type;
        popup.appendChild(type);
      }

      if (organization.address) {
        const address = document.createElement('span');
        address.textContent = organization.address;
        popup.appendChild(address);
      }

      const profileLink = document.createElement('a');
      profileLink.href = `/organization-profile/${encodeURIComponent(
        organization.id
      )}`;
      profileLink.textContent = 'View organization profile';
      profileLink.addEventListener('click', (event) => {
        event.preventDefault();
        navigate(profileLink.pathname);
      });
      popup.appendChild(profileLink);
      marker.bindPopup(popup);
      marker.on('click', () => setSelectedOrganizationId(organization.id));
      organizationMarkersRef.current.set(organization.id, marker);
    });

    const selectedMarker = selectedOrganization
      ? organizationMarkersRef.current.get(selectedOrganization.id)
      : undefined;

    if (selectedMarker) {
      map.setView(selectedMarker.getLatLng(), 14, { animate: true });
      selectedMarker.openPopup();
    } else if (sharingEnabled && location) {
      map.setView([location.latitude, location.longitude], 12);
    } else if (organizationMarkersRef.current.size > 1) {
      map.fitBounds(
        L.featureGroup(
          Array.from(organizationMarkersRef.current.values())
        ).getBounds(),
        { padding: [30, 30], maxZoom: 12 }
      );
    }

    window.requestAnimationFrame(() => {
      if (mapRef.current === map && map.getPane('mapPane')) {
        map.invalidateSize({ animate: false });
      }
    });
  }, [
    location,
    organizationLocations,
    organizationsWithLocations,
    navigate,
    selectedOrganization,
    sharingEnabled,
  ]);

  // Ionic page transitions can affect Leaflet map dimensions.
  useEffect(() => {
    let timeoutId: number | undefined;
    let frameId: number | undefined;

    const refreshMapSize = () => {
      frameId = window.requestAnimationFrame(() => {
        mapRef.current?.invalidateSize({ animate: false });
      });

      timeoutId = window.setTimeout(() => {
        mapRef.current?.invalidateSize({ animate: false });
      }, 300);
    };

    refreshMapSize();

    return () => {
      if (frameId !== undefined) {
        window.cancelAnimationFrame(frameId);
      }

      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
    };
  }, []);

  // Refresh map size whenever this Ionic page becomes visible.
  const refreshMap = useCallback(() => {
    window.requestAnimationFrame(() => {
      mapRef.current?.invalidateSize({ animate: false });
    });

    window.setTimeout(() => {
      mapRef.current?.invalidateSize({ animate: false });
    }, 300);
  }, []);

  useIonViewDidEnter(refreshMap, [refreshMap]);

  // Update map marker when the approximate location changes.
  useEffect(() => {
    const map = mapRef.current;

    if (!map) return;

    markerRef.current?.remove();
    accuracyCircleRef.current?.remove();

    markerRef.current = null;
    accuracyCircleRef.current = null;

    if (!location || !sharingEnabled) {
      const currentOrganization = selectedOrganizationRef.current;
      const selectedMarker = currentOrganization
        ? organizationMarkersRef.current.get(currentOrganization.id)
        : undefined;

      if (selectedMarker) {
        map.setView(selectedMarker.getLatLng(), 14);
      } else if (organizationMarkersRef.current.size > 1) {
        map.fitBounds(
          L.featureGroup(
            Array.from(organizationMarkersRef.current.values())
          ).getBounds(),
          { padding: [30, 30], maxZoom: 12 }
        );
      } else {
        map.setView(DEFAULT_CENTER, 5);
      }
      refreshMap();
      return;
    }

    const coordinates: L.LatLngExpression = [
      location.latitude,
      location.longitude,
    ];

    map.setView(coordinates, 11);

    accuracyCircleRef.current = L.circle(coordinates, {
      radius: 700,
      color: '#24783b',
      fillColor: '#49a967',
      fillOpacity: 0.15,
      weight: 2,
    }).addTo(map);

    markerRef.current = L.circleMarker(coordinates, {
      radius: 9,
      color: '#ffffff',
      weight: 3,
      fillColor: '#24783b',
      fillOpacity: 1,
    })
      .addTo(map)
      .bindPopup('Your approximate location');

    refreshMap();

    return () => {
      markerRef.current?.remove();
      accuracyCircleRef.current?.remove();

      markerRef.current = null;
      accuracyCircleRef.current = null;
    };
  }, [location, sharingEnabled, refreshMap]);

  // Retry map tiles.
  const retryMap = () => {
    setMapError('');
    setMapLoading(true);

    tileLayerRef.current?.redraw();
    refreshMap();
  };

  // Request browser location permission.
  const enableLocationSharing = () => {
    setErrorMessage('');

    if (!consentChecked) {
      setErrorMessage(
        'Please read and accept the location preview consent first.'
      );
      return;
    }

    if (!navigator.geolocation) {
      setErrorMessage(
        'Geolocation is not supported by this browser.'
      );
      return;
    }

    setLoading(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const approximateLocation = roundCoordinates(
          position.coords.latitude,
          position.coords.longitude
        );

        setLocation(approximateLocation);
        setSharingEnabled(true);
        setLoading(false);

        setToastMessage(
          'Your approximate location is now available in the map preview.'
        );
      },
      (error) => {
        setLoading(false);

        switch (error.code) {
          case error.PERMISSION_DENIED:
            setErrorMessage(
              'Location permission was denied. Allow location access in your browser settings and try again.'
            );
            break;

          case error.POSITION_UNAVAILABLE:
            setErrorMessage(
              'Your current location is unavailable. Please try again.'
            );
            break;

          case error.TIMEOUT:
            setErrorMessage(
              'The location request timed out. Please try again.'
            );
            break;

          default:
            setErrorMessage(
              'Something went wrong while getting your location.'
            );
        }
      },
      {
        enableHighAccuracy: false,
        timeout: 15000,
        maximumAge: 60000,
      }
    );
  };

  // Turn off the local location preview.
  const disableLocationSharing = () => {
    setSharingEnabled(false);
    setLocation(null);
    setConsentChecked(false);
    setErrorMessage('');

    setToastMessage('Location preview has been disabled.');
  };

  return (
    <IonPage className="student-location-page">
      <IonContent fullscreen className="student-location-content">
        <main className="location-live-map-screen">
          <div
            ref={mapContainerRef}
            className="student-location-map"
            aria-label="Map of organization locations"
          />

          <div className="location-map-topbar">
            <IonButton
              fill="clear"
              className="location-map-back"
              onClick={goBackHome}
              aria-label="Back to Student Home"
            >
              <IonIcon icon={arrowBackOutline} />
            </IonButton>

            <div className="location-map-brand">
              <IonIcon icon={locationOutline} />
              <div>
                <strong>GrantAccess Map</strong>
                <span>Organization locations</span>
              </div>
            </div>

            <IonButton
              fill="clear"
              className="location-map-locate"
              onClick={sharingEnabled ? () => {
                if (location) {
                  mapRef.current?.setView(
                    [location.latitude, location.longitude],
                    14
                  );
                }
              } : undefined}
              disabled={!sharingEnabled || !location}
              aria-label="Center on my location"
            >
              <IonIcon icon={navigateOutline} />
            </IonButton>
          </div>

          {mapLoading && (
            <div className="location-map-loading">
              <IonSpinner name="crescent" />
              <span>Loading map...</span>
            </div>
          )}

          {(mapError || organizationError) && (
            <div className="location-map-error" role="alert">
              <IonIcon icon={informationCircleOutline} />
              <span>{organizationError || mapError}</span>
              {mapError && (
                <IonButton
                  size="small"
                  fill="clear"
                  onClick={retryMap}
                  aria-label="Retry loading map"
                >
                  <IonIcon icon={refreshOutline} />
                </IonButton>
              )}
            </div>
          )}

          <section
            className={`location-map-sheet ${
              organizationSheetExpanded ? 'expanded' : 'collapsed'
            }`}
          >
            <div className="location-sheet-handle" aria-hidden="true">
              <span />
            </div>

            <div className="location-sheet-heading">
              <div>
                <h1>Organizations near you</h1>
                <p>
                  Tap an organization to see its map pin and profile.
                </p>
              </div>
              <span className="location-sheet-count">
                {organizationsWithLocations.length}
              </span>
              <button
                type="button"
                className="location-sheet-toggle"
                onClick={() =>
                  setOrganizationSheetExpanded((expanded) => !expanded)
                }
                aria-label={
                  organizationSheetExpanded
                    ? 'Collapse organization list'
                    : 'Expand organization list'
                }
                aria-expanded={organizationSheetExpanded}
              >
                <IonIcon
                  icon={
                    organizationSheetExpanded
                      ? chevronDownOutline
                      : chevronUpOutline
                  }
                />
              </button>
            </div>

            <IonSearchbar
              className="location-organization-search"
              value={organizationSearch}
              onIonInput={(event) =>
                setOrganizationSearch(event.detail.value || '')
              }
              placeholder="Search organizations"
              aria-label="Search organizations"
              debounce={150}
            />

            <div className="location-organization-list">
              {organizationLoading ? (
                <div className="location-list-state">
                  <IonSpinner name="crescent" />
                  <span>Loading organizations...</span>
                </div>
              ) : filteredOrganizations.length > 0 ? (
                filteredOrganizations.map((organization) => (
                  <article
                    className={`location-organization-row ${
                      selectedOrganization?.id === organization.id
                        ? 'selected'
                        : ''
                    }`}
                    key={organization.id}
                  >
                    <button
                      type="button"
                      className="location-organization-select"
                      onClick={() =>
                        setSelectedOrganizationId(organization.id)
                      }
                    >
                      {organization.logo ? (
                        <img
                          className="location-organization-avatar"
                          src={organization.logo}
                          alt=""
                        />
                      ) : (
                        <span className="location-organization-avatar placeholder">
                          <IonIcon icon={businessOutline} />
                        </span>
                      )}
                      <span className="location-organization-details">
                        <strong>{organization.name}</strong>
                        <span className="location-organization-address">
                          {organization.address ||
                            organization.type ||
                            'Organization location'}
                        </span>
                        {organization.type && organization.address && (
                          <span className="location-organization-type">
                            {organization.type}
                          </span>
                        )}
                      </span>
                    </button>

                    <IonButton
                      fill="clear"
                      className="location-profile-button"
                      onClick={() =>
                        navigate(
                          `/organization-profile/${encodeURIComponent(
                            organization.id
                          )}`
                        )
                      }
                    >
                      View
                    </IonButton>
                  </article>
                ))
              ) : (
                <div className="location-list-state">
                  <IonIcon icon={businessOutline} />
                  <span>
                    {organizationSearch
                      ? 'No organizations match your search.'
                      : 'No organization locations are available yet. An LGU/School account must save its address or map pin.'}
                  </span>
                </div>
              )}
            </div>

            {selectedOrganization && (
              <p className="location-selected-status" role="status">
                <IonIcon icon={locationOutline} />
                {organizationMapStatus}
              </p>
            )}

            <div className="location-sharing-compact">
              {!sharingEnabled ? (
                <>
                  <label className="location-sharing-consent">
                    <input
                      type="checkbox"
                      checked={consentChecked}
                      onChange={(event) =>
                        setConsentChecked(event.target.checked)
                      }
                    />
                    <span>
                      Show my approximate location on this device only.
                    </span>
                  </label>
                  <IonButton
                    className="location-sharing-button"
                    onClick={enableLocationSharing}
                    disabled={loading || !consentChecked}
                  >
                    {loading ? (
                      <IonSpinner name="crescent" />
                    ) : (
                      <IonIcon icon={navigateOutline} slot="start" />
                    )}
                    {loading ? 'Locating...' : 'Use my location'}
                  </IonButton>
                </>
              ) : (
                <>
                  <span className="location-sharing-enabled">
                    <IonIcon icon={shieldCheckmarkOutline} />
                    Your location is private on this device.
                  </span>
                  <IonButton
                    fill="clear"
                    className="location-sharing-disable"
                    onClick={disableLocationSharing}
                  >
                    <IonIcon icon={eyeOffOutline} slot="start" />
                    Turn off
                  </IonButton>
                </>
              )}
            </div>

            {errorMessage && (
              <p className="location-sharing-error" role="alert">
                {errorMessage}
              </p>
            )}
          </section>
        </main>

        <IonToast
          isOpen={!!toastMessage}
          message={toastMessage}
          duration={2500}
          position="bottom"
          color="success"
          onDidDismiss={() => setToastMessage('')}
        />
      </IonContent>
    </IonPage>
  );
};

export default StudentLocation;
