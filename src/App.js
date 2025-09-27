import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';

/* Debounce input to limit API calls */
const useDebounce = (value, delay) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
};

/* Weather code mapping */
const getWeatherInfo = (code, isDay = true) => {
  const map = {
    0: {
      icon: isDay ? '☀️' : '🌙',
      description: isDay ? 'Sunny' : 'Clear night',
    },
    1: {
      icon: isDay ? '🌤️' : '🌙',
      description: isDay ? 'Mostly sunny' : 'Mostly clear night',
    },
    2: { icon: isDay ? '⛅' : '☁️', description: 'Partly cloudy' },
    3: { icon: '☁️', description: 'Cloudy' },
    45: { icon: '🌫️', description: 'Foggy' },
    48: { icon: '🌫️', description: 'Rime fog' },
    51: { icon: '🌦️', description: 'Light drizzle' },
    53: { icon: '🌦️', description: 'Drizzle' },
    55: { icon: '🌦️', description: 'Heavy drizzle' },
    56: { icon: '🌨️', description: 'Freezing drizzle' },
    57: { icon: '🌨️', description: 'Heavy freezing drizzle' },
    61: { icon: '🌧️', description: 'Light rain' },
    63: { icon: '🌧️', description: 'Rain' },
    65: { icon: '🌧️', description: 'Heavy rain' },
    66: { icon: '🌨️', description: 'Freezing rain' },
    67: { icon: '🌨️', description: 'Heavy freezing rain' },
    71: { icon: '❄️', description: 'Light snow' },
    73: { icon: '❄️', description: 'Snow' },
    75: { icon: '❄️', description: 'Heavy snow' },
    77: { icon: '🌨️', description: 'Snow grains' },
    80: { icon: '🌦️', description: 'Light showers' },
    81: { icon: '🌧️', description: 'Showers' },
    82: { icon: '🌧️', description: 'Heavy showers' },
    85: { icon: '🌨️', description: 'Light snow showers' },
    86: { icon: '🌨️', description: 'Heavy snow showers' },
    95: { icon: '⛈️', description: 'Thunderstorm' },
    96: { icon: '⛈️', description: 'Thunderstorm with hail' },
    99: { icon: '⛈️', description: 'Severe thunderstorm' },
  };
  return map[code] || { icon: '🌤️', description: 'Fair weather' };
};

/* Time helpers */
const getCurrentTimeInfo = () => {
  const now = new Date();
  const out = [];
  for (let i = 0; i < 12; i++) {
    const t = new Date(now.getTime() + i * 60 * 60 * 1000);
    out.push({
      time: t,
      shortTime: t.toLocaleTimeString('en-US', {
        hour: 'numeric',
        hour12: true,
      }),
    });
  }
  return out;
};
const formatDay = (iso) => {
  const d = new Date(iso);
  const today = new Date();
  const tmrw = new Date(today);
  tmrw.setDate(tmrw.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === tmrw.toDateString()) return 'Tomorrow';
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
};
const getWindDirection = (deg) => {
  const dirs = [
    'N',
    'NNE',
    'NE',
    'ENE',
    'E',
    'ESE',
    'SE',
    'SSE',
    'S',
    'SSW',
    'SW',
    'WSW',
    'W',
    'WNW',
    'NW',
    'NNW',
  ];
  return dirs[Math.round(deg / 22.5) % 16];
};

/* API */
const fetchWeatherData = async (lat, lon, tz = 'auto') => {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,weather_code,is_day,apparent_temperature,precipitation,cloud_cover` +
    `&hourly=temperature_2m,weather_code,precipitation_probability,wind_speed_10m,relative_humidity_2m` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset` +
    `&timezone=${tz}&forecast_days=7&forecast_hours=24`;
  const r = await fetch(url);
  if (!r.ok) throw new Error('Weather service temporarily unavailable');
  const data = await r.json();
  if (!data.current || !data.hourly || !data.daily)
    throw new Error('Invalid weather data received');
  return data;
};

const searchLocations = async (query) => {
  if (!query || query.length < 2) return [];
  const r = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
      query
    )}&count=10&language=en&format=json`
  );
  if (!r.ok) return [];
  const data = await r.json();
  return data.results || [];
};

const formatLocationForDropdown = (loc) => {
  const parts = [loc.name];
  if (loc.admin3 && loc.admin3 !== loc.name) parts.push(`${loc.admin3} Mandal`);
  if (loc.admin2 && loc.admin2 !== loc.admin3)
    parts.push(`${loc.admin2} District`);
  if (loc.admin1) parts.push(loc.admin1);
  if (loc.country) parts.push(loc.country);
  return parts.join(', ');
};

const formatLocationDisplay = (info) => {
  const p = [];
  if (info.name) p.push(info.name);
  if (info.admin3 && info.admin3 !== info.name) p.push(`${info.admin3} Mandal`);
  if (info.admin2 && info.admin2 !== info.admin3)
    p.push(`${info.admin2} District`);
  if (info.admin1) p.push(info.admin1);
  if (info.country) p.push(info.country);
  return p.join(', ');
};

/* Geolocation + reverse geocode */
const getCurrentLocation = () =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation)
      return reject(new Error('Geolocation is not supported by this browser'));
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }),
      (err) => {
        let msg = 'Unable to get your location';
        if (err.code === err.PERMISSION_DENIED)
          msg = 'Location access denied. Please enable permissions.';
        else if (err.code === err.POSITION_UNAVAILABLE)
          msg = 'Location unavailable. Try again.';
        else if (err.code === err.TIMEOUT) msg = 'Location request timed out.';
        reject(new Error(msg));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 300000 }
    );
  });

const reverseGeocode = async (latitude, longitude) => {
  try {
    const response = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=&latitude=${latitude}&longitude=${longitude}&count=15&language=en&format=json`
    );
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data.results) && data.results.length) {
        const scored = data.results.map((r) => {
          const detail =
            (r.name ? 2 : 0) +
            (r.admin1 ? 1 : 0) +
            (r.admin2 ? 1 : 0) +
            (r.country ? 2 : 0);
          const pop = r.population
            ? Math.min(3, Math.floor(Math.log10(r.population + 1)))
            : 0;
          const dist =
            2 -
            (Math.abs((r.latitude || 0) - latitude) +
              Math.abs((r.longitude || 0) - longitude));
          return { r, score: detail + pop + dist };
        });
        scored.sort((a, b) => b.score - a.score);
        const best = scored[0].r;
        const displayName =
          best.name ||
          best.admin3 ||
          best.admin2 ||
          best.admin1 ||
          best.country ||
          'Current Location';
        return {
          name: displayName,
          latitude,
          longitude,
          admin1: best.admin1 || '',
          admin2: best.admin2 || '',
          admin3: best.admin3 || '',
          admin4: best.admin4 || '',
          country: best.country || best.country_code || '',
          timezone: best.timezone || 'auto',
        };
      }
    }
    try {
      const ipRes = await fetch('https://ipapi.co/json/');
      if (ipRes.ok) {
        const ip = await ipRes.json();
        const displayName =
          ip.city || ip.region || ip.country_name || 'Current Location';
        return {
          name: displayName,
          latitude,
          longitude,
          admin1: ip.region || '',
          admin2: '',
          admin3: '',
          admin4: '',
          country: ip.country_name || '',
          timezone: ip.timezone || 'auto',
        };
      }
    } catch {}
    return {
      name: 'Current Location',
      latitude,
      longitude,
      admin1: '',
      admin2: '',
      admin3: '',
      admin4: '',
      country: '',
      timezone: 'auto',
    };
  } catch {
    return {
      name: 'Current Location',
      latitude,
      longitude,
      admin1: '',
      admin2: '',
      admin3: '',
      admin4: '',
      country: '',
      timezone: 'auto',
    };
  }
};

/* Portal dropdown positioned to input */
const DropdownPortal = ({ anchorRef, open, children }) => {
  if (typeof document === 'undefined') return null;
  const portalRoot = document.getElementById('portal-root');
  const [style, setStyle] = useState(null);

  useEffect(() => {
    if (!open) return setStyle(null);
    const updatePos = () => {
      const container = anchorRef?.current;
      if (!container) return setStyle(null);
      const inputEl = container.querySelector('input');
      if (!inputEl) return setStyle(null);
      const rect = inputEl.getBoundingClientRect();
      setStyle({
        position: 'fixed',
        top: Math.round(rect.bottom + 8),
        left: Math.round(rect.left),
        width: Math.round(rect.width),
        maxHeight: '48vh',
        zIndex: 2000,
      });
    };
    updatePos();
    window.addEventListener('resize', updatePos);
    window.addEventListener('scroll', updatePos, true);
    return () => {
      window.removeEventListener('resize', updatePos);
      window.removeEventListener('scroll', updatePos, true);
    };
  }, [anchorRef, open]);

  if (!open || !portalRoot || !style) return null;
  return ReactDOM.createPortal(
    <div style={style} className="suggestions-dropdown portal">
      {children}
    </div>,
    portalRoot
  );
};

/* Rain chance */
const getRainChancePercent = (data) => {
  const hourly = data?.hourly?.precipitation_probability || [];
  if (hourly.length > 0) {
    const n = Math.min(3, hourly.length);
    return Math.round(hourly.slice(0, n).reduce((a, b) => a + (b || 0), 0) / n);
  }
  const daily = data?.daily?.precipitation_probability_max?.[0];
  return typeof daily === 'number' ? daily : 0;
};

function App() {
  const [cityName, setCityName] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [showClear, setShowClear] = useState(false);

  const [weatherData, setWeatherData] = useState(null);
  const [locationInfo, setLocationInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [error, setError] = useState('');

  const inputRef = useRef(null);
  const debounced = useDebounce(cityName, 300);

  /* Autocomplete */
  useEffect(() => {
    let active = true;
    (async () => {
      if (!debounced || debounced.length < 2) {
        if (active) {
          setSuggestions([]);
          setShowSuggestions(false);
          setLoadingSuggestions(false);
        }
        return;
      }
      setLoadingSuggestions(true);
      const res = await searchLocations(debounced);
      if (active) {
        setSuggestions(res);
        setShowSuggestions(true);
        setLoadingSuggestions(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [debounced]);

  /* Close dropdown on outside click */
  useEffect(() => {
    const onClick = (e) => {
      const container = inputRef.current;
      if (container && !container.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const forceCloseDropdown = () => {
    setShowSuggestions(false);
    setSuggestions([]);
    const inputEl = inputRef.current?.querySelector('input');
    inputEl?.blur();
  };

  const handleCityChange = (e) => {
    const v = e.target.value;
    setCityName(v);
    setShowClear(v.length > 0);
    setShowSuggestions(true);
  };

  const clearInput = () => {
    setCityName('');
    setShowClear(false);
    setSuggestions([]);
    setShowSuggestions(false);
    inputRef.current?.querySelector('input')?.focus();
  };

  const handleSuggestionSelect = async (item) => {
    try {
      forceCloseDropdown();
      if (
        typeof item?.latitude === 'number' &&
        typeof item?.longitude === 'number'
      ) {
        await searchByLocation(item);
        return;
      }
      if (item?.name) {
        const results = await searchLocations(item.name);
        const match =
          results.find(
            (r) =>
              r.name === item.name &&
              ((item.admin1 && r.admin1 === item.admin1) || !item.admin1)
          ) || results[0];

        if (
          match &&
          typeof match.latitude === 'number' &&
          typeof match.longitude === 'number'
        ) {
          await searchByLocation(match);
          return;
        }
      }
      setCityName(item?.name || '');
    } catch (err) {
      setError(err.message || 'Failed to load weather for selected place.');
    }
  };

  const submitSearch = async (e) => {
    e.preventDefault();
    try {
      forceCloseDropdown();
      const firstWithCoords = suggestions.find(
        (s) => typeof s.latitude === 'number' && typeof s.longitude === 'number'
      );
      if (firstWithCoords) {
        await searchByLocation(firstWithCoords);
        return;
      }
      if (cityName && cityName.trim().length >= 2) {
        const results = await searchLocations(cityName.trim());
        if (results.length) {
          await searchByLocation(results[0]);
          return;
        }
      }
      setError(
        'Please pick a city from suggestions or type a valid city name.'
      );
    } catch (err) {
      setError(err.message || 'Search failed.');
    }
  };

  const useCurrentLocation = async () => {
    forceCloseDropdown();
    setGettingLocation(true);
    setError('');
    try {
      const c = await getCurrentLocation();
      const loc = await reverseGeocode(c.latitude, c.longitude);
      forceCloseDropdown();
      await searchByLocation(loc);
    } catch (err) {
      setError(`Location Error: ${err.message}`);
    } finally {
      setGettingLocation(false);
    }
  };

  const searchByLocation = async (loc) => {
    // Guard: ensure coords exist, else try name lookup
    if (
      typeof loc?.latitude !== 'number' ||
      typeof loc?.longitude !== 'number'
    ) {
      if (loc?.name) {
        const results = await searchLocations(loc.name);
        const best = results[0];
        if (
          best &&
          typeof best.latitude === 'number' &&
          typeof best.longitude === 'number'
        ) {
          return searchByLocation(best);
        }
      }
      throw new Error(
        'Selected place is missing coordinates. Please pick another suggestion.'
      );
    }

    forceCloseDropdown();
    setLoading(true);
    setError('');
    setWeatherData(null);
    try {
      const locInfo = {
        latitude: loc.latitude,
        longitude: loc.longitude,
        name: loc.name,
        admin1: loc.admin1 || '',
        admin2: loc.admin2 || '',
        admin3: loc.admin3 || '',
        admin4: loc.admin4 || '',
        country: loc.country || loc.country_code || '',
        timezone: loc.timezone || 'auto',
      };
      setLocationInfo(locInfo);

      const data = await fetchWeatherData(
        locInfo.latitude,
        locInfo.longitude,
        locInfo.timezone
      );
      setWeatherData(data);

      const isReverse =
        !loc.country_code && !loc.population && !('elevation' in loc);
      const formatted = isReverse ? loc.name : formatLocationForDropdown(loc);
      setCityName(formatted);
      setShowClear(!!formatted);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      {/* Header */}
      <div className="welcome-section">
        <h1 className="app-title">Weather Now</h1>
        <div className="user-info">
          <h2>Hi Jamie! 👋</h2>
          <p>
            Ready to help you get accurate weather forecasts for all your
            outdoor adventures!
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="search-section">
        <h3>Which city would you like to check?</h3>

        <div className="location-options">
          <button
            onClick={useCurrentLocation}
            className="current-location-btn"
            disabled={gettingLocation || loading}
          >
            {gettingLocation ? (
              <>
                <span className="location-spinner"></span>Getting location...
              </>
            ) : (
              <>📍 Use my current location</>
            )}
          </button>
        </div>

        <div className="search-container" ref={inputRef}>
          <form onSubmit={submitSearch} className="search-form">
            <div className="input-wrapper">
              <input
                type="text"
                value={cityName}
                onChange={handleCityChange}
                onFocus={() =>
                  suggestions.length &&
                  cityName.length >= 2 &&
                  setShowSuggestions(true)
                }
                onKeyDown={(e) => {
                  if (e.key === 'Escape') forceCloseDropdown();
                }}
                onBlur={() => setTimeout(forceCloseDropdown, 120)}
                placeholder="Type city name... (e.g., Munagapadu, Mumbai, New York)"
                className="city-input"
                disabled={loading}
              />
              {showClear && (
                <button
                  type="button"
                  onClick={clearInput}
                  className="clear-btn"
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}
            </div>
            <button
              type="submit"
              className="search-btn"
              disabled={loading || loadingSuggestions}
            >
              {loading ? 'Searching...' : 'Get Weather'}
            </button>
          </form>

          {/* Suggestions in portal to avoid overlap */}
          <DropdownPortal
            anchorRef={inputRef}
            open={showSuggestions && (suggestions.length || loadingSuggestions)}
          >
            {loadingSuggestions ? (
              <div className="suggestion-item loading-suggestion">
                <span className="suggestion-spinner"></span>
                Searching locations...
              </div>
            ) : (
              suggestions.map((s, i) => (
                <div
                  key={`${s.id || ''}-${s.latitude || ''}-${
                    s.longitude || ''
                  }-${i}`}
                  className="suggestion-item"
                  onMouseDown={(e) => {
                    e.preventDefault(); // prevent blur stealing the click
                    handleSuggestionSelect(s);
                  }}
                  onClick={(e) => e.preventDefault()}
                >
                  <div className="suggestion-name">{s.name}</div>
                  <div className="suggestion-details">
                    {formatLocationForDropdown(s)}
                  </div>
                </div>
              ))
            )}
          </DropdownPortal>
        </div>

        {/* Quick cities */}
        <div className="quick-search">
          <div className="quick-search-title">Popular cities:</div>
          <div className="quick-cities">
            {[
              'London',
              'Tokyo',
              'Mumbai',
              'Sydney',
              'Dubai',
              'Tromsø',
              'Hyderabad',
            ].map((c) => (
              <span
                key={c}
                className="quick-city"
                onClick={() => setCityName(c)}
              >
                {c}
              </span>
            ))}
          </div>
        </div>

        {error && <div className="error">⚠️ {error}</div>}
      </div>

      {/* Loading */}
      {loading && (
        <div className="loading">
          <div className="spinner"></div>
          <p>Fetching weather data...</p>
        </div>
      )}

      {/* Weather Display */}
      {weatherData && locationInfo && (
        <div className="weather-display">
          <div className="hero-header">
            <div className="hero-city">{locationInfo.name?.toLowerCase()}</div>
            <div className="hero-date">
              {new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </div>
          </div>

          <div className="hero-row">
            <div className="hero-icon">
              {
                getWeatherInfo(
                  weatherData.current.weather_code,
                  weatherData.current.is_day
                ).icon
              }
            </div>

            <div className="hero-temp-block">
              <div className="hero-temp">
                {Math.round(weatherData.current.temperature_2m)}°C
              </div>
              <div className="hero-condition">
                {
                  getWeatherInfo(
                    weatherData.current.weather_code,
                    weatherData.current.is_day
                  ).description
                }
              </div>
            </div>
          </div>

          <div className="hero-stats">
            <div className="hero-stat-card">
              <div className="hero-stat-label">Wind</div>
              <div className="hero-stat-value">
                {Math.round(weatherData.current.wind_speed_10m)} km/h
              </div>
            </div>
            <div className="hero-stat-card">
              <div className="hero-stat-label">Humidity</div>
              <div className="hero-stat-value">
                {weatherData.current.relative_humidity_2m}%
              </div>
            </div>
            <div className="hero-stat-card">
              <div className="hero-stat-label">Rain Chance</div>
              <div className="hero-stat-value">
                {getRainChancePercent(weatherData)}%
              </div>
            </div>
          </div>

          <div className="current-conditions" style={{ marginTop: '1rem' }}>
            <div className="condition-item">
              <span className="condition-label">Feels like:</span>
              <span className="condition-value">
                {Math.round(
                  weatherData.current.apparent_temperature ||
                    weatherData.current.temperature_2m
                )}
                °C
              </span>
            </div>
            <div className="condition-item">
              <span className="condition-label">Cloud cover:</span>
              <span className="condition-value">
                {weatherData.current.cloud_cover || 0}%
              </span>
            </div>
            <div className="condition-item">
              <span className="condition-label">Wind dir:</span>
              <span className="condition-value">
                {getWindDirection(weatherData.current.wind_direction_10m)}
              </span>
            </div>
          </div>

          <div className="hourly-section">
            <h3 className="hourly-title">Next 12 Hours</h3>
            <div className="hourly-scroll">
              {getCurrentTimeInfo().map((t, i) => {
                if (i >= weatherData.hourly.time.length) return null;
                const info = getWeatherInfo(weatherData.hourly.weather_code[i]);
                const temp = Math.round(weatherData.hourly.temperature_2m[i]);
                const rain =
                  weatherData.hourly.precipitation_probability[i] || 0;
                return (
                  <div key={i} className="hourly-item">
                    <div className="hourly-time">
                      {i === 0 ? 'Now' : t.shortTime}
                    </div>
                    <div className="hourly-icon">{info.icon}</div>
                    <div className="hourly-temp">{temp}°</div>
                    {rain > 30 && <div className="hourly-rain">💧{rain}%</div>}
                    <div className="hourly-condition">{info.description}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="forecast-section">
            <h3 className="forecast-title">7-Day Forecast</h3>
            <div className="forecast-grid">
              {weatherData.daily.time.map((d, i) => {
                const info = getWeatherInfo(weatherData.daily.weather_code[i]);
                const p = weatherData.daily.precipitation_probability_max[i];
                return (
                  <div key={d} className="forecast-day">
                    <div className="day-name">{formatDay(d)}</div>
                    <div className="forecast-icon">{info.icon}</div>
                    <div className="temp-range">
                      <span className="temp-high">
                        {Math.round(weatherData.daily.temperature_2m_max[i])}°
                      </span>
                      {' / '}
                      <span className="temp-low">
                        {Math.round(weatherData.daily.temperature_2m_min[i])}°
                      </span>
                    </div>
                    <div className="weather-condition">{info.description}</div>
                    {p > 0 && <div className="weather-desc">💧{p}% chance</div>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen overlay during current-location resolve */}
      {gettingLocation && (
        <div className="fullscreen-overlay">
          <div className="overlay-card">
            <span className="location-spinner big"></span>
            <div>Detecting current location…</div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="footer">
        <div className="api-credit">
          <p>Powered by Open-Meteo API</p>
          <p>Free weather data for Jamie's outdoor adventures</p>
        </div>
      </div>
    </div>
  );
}

export default App;
