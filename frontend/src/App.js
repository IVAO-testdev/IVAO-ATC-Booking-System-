import React, { useEffect, useState, useMemo, useCallback } from 'react';
import axios from 'axios';
import { format, addDays, startOfMonth, endOfMonth, eachDayOfInterval, parseISO, formatISO } from 'date-fns';
import './App.css';

const getApiBase = () => {
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:3001';
  }
  
  return `${protocol}//${hostname}:3001`;
};

const API_BASE = getApiBase();

const RATING_LEVELS = {
  0: 'NO_RATING',
  1: 'OBS',
  2: 'AS1',
  3: 'AS2',
  4: 'AS3',
  5: 'ADC',
  6: 'APC',
  7: 'ACC',
  8: 'SEC',
  9: 'SAI',
  10: 'CAI',
  11: 'SUP',
  12: 'ADM'
};

const sanitize = (str, max = 500) => {
  if (!str) return '';
  return String(str).slice(0, max).replace(/[<>"'`]/g, '').trim();
};

const validTime = (t) => /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(t);

export default function App() {
  const [bookings, setBookings] = useState([]);
  const [positions, setPositions] = useState([]);
  const [token, setToken] = useState(localStorage.getItem('we_token') || '');
  const [currentUser, setCurrentUser] = useState(null);
  const [vidInput, setVidInput] = useState('');
  const [selectedDivision, setSelectedDivision] = useState('');
  const [ratingFilter, setRatingFilter] = useState('');
  const [viewMode, setViewMode] = useState('list');
  const [timelineDate, setTimelineDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedDayBookings, setSelectedDayBookings] = useState(null);
  const [dateRange, setDateRange] = useState('7days');
  const [positionDropdown, setPositionDropdown] = useState(false);
  const [positionSearch, setPositionSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  
  const [form, setForm] = useState({
    position: '',
    notes: '',
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    trainingMode: false,
    examMode: false,
    noVoice: false
  });

  useEffect(() => {
    fetchPositions();
    fetchBookings();
    if (token) fetchUser();
    
    const handleClickOutside = (e) => {
      if (!e.target.closest('.custom-select-wrapper')) {
        setPositionDropdown(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    
    return () => {
      document.removeEventListener('click', handleClickOutside);
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [selectedDivision]);

  const fetchUser = async () => {
    if (!token) return setCurrentUser(null);
    try {
      const r = await axios.get(`${API_BASE}/auth/me`, { 
        headers: { Authorization: `Bearer ${token}` } 
      });
      if (r.data?.user) {
        setCurrentUser(r.data.user);
      } else {
        setCurrentUser(null);
        setToken('');
        localStorage.removeItem('we_token');
      }
    } catch (e) {
      setCurrentUser(null);
      setToken('');
      localStorage.removeItem('we_token');
    }
  };

  const fetchPositions = async () => {
    try {
      const r = await axios.get(`${API_BASE}/positions`, { timeout: 10000 });
      setPositions(r.data || []);
    } catch (e) {
      if (e.code === 'ECONNABORTED') {
        setError('Network timeout - please check your connection');
      } else if (e.response?.status >= 500) {
        setError('Server error - please try again later');
      } else {
        setError('Failed to load positions');
      }
      setTimeout(() => setError(''), 5000);
    }
  };

  const fetchBookings = async () => {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const r = await axios.get(`${API_BASE}/bookings`, { headers, timeout: 10000 });
      setBookings(r.data || []);
    } catch (e) {
      if (e.code === 'ECONNABORTED') {
        setError('Network timeout - please refresh the page');
      } else if (e.response?.status >= 500) {
        setError('Server error - bookings may be outdated');
      } else {
        setError('Failed to load bookings');
      }
      setTimeout(() => setError(''), 5000);
    }
  };

  const handleLogin = async () => {
    if (!vidInput) return setError('Please enter your VID');
    if (!/^\d{1,10}$/.test(vidInput)) {
      setError('VID must be numeric (1-10 digits)');
      setTimeout(() => setError(''), 5000);
      return;
    }
    try {
      const r = await axios.post(`${API_BASE}/auth/login`, { vid: sanitize(vidInput, 20) }, { timeout: 15000 });
      if (r.data?.error) {
        setError(r.data.error);
        setTimeout(() => setError(''), 5000);
        return;
      }
      const t = r.data?.token;
      const user = r.data?.user;
      if (t && user) {
        localStorage.setItem('we_token', t);
        setToken(t);
        setCurrentUser(user);
        setVidInput('');
        setSuccess('Logged in successfully');
        setTimeout(() => setSuccess(''), 3000);
        fetchBookings();
      } else {
        setError('Invalid response from server');
        setTimeout(() => setError(''), 5000);
      }
    } catch (e) {
      if (e.code === 'ECONNABORTED') {
        setError('Login timeout - IVAO API may be slow, please try again');
      } else if (e.response?.status === 503) {
        setError('Service temporarily unavailable - please try again later');
      } else {
        setError(e.response?.data?.message || e.message || 'Login failed');
      }
      setTimeout(() => setError(''), 5000);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('we_token');
    setToken('');
    setCurrentUser(null);
    setSuccess('Logged out successfully');
    setTimeout(() => setSuccess(''), 3000);
  };

  const getUTCNow = () => {
    return new Date();
  };

  const parseUTC = (d, t) => {
    if (!d || !t) return null;
    const [y, m, day] = d.split('-');
    const [h, min] = t.split(':');
    return new Date(Date.UTC(y, m - 1, day, h, min));
  };

  const formatUTC = (dt) => {
    if (!dt) return { date: '', time: '' };
    const d = parseISO(dt);
    return { date: format(d, 'yyyy-MM-dd'), time: format(d, 'HH:mm') };
  };

  const getUTCTimeString = () => {
    const year = currentTime.getUTCFullYear();
    const month = String(currentTime.getUTCMonth() + 1).padStart(2, '0');
    const day = String(currentTime.getUTCDate()).padStart(2, '0');
    const hours = String(currentTime.getUTCHours()).padStart(2, '0');
    const minutes = String(currentTime.getUTCMinutes()).padStart(2, '0');
    const seconds = String(currentTime.getUTCSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (!currentUser) {
      setError('Please login first');
      return;
    }

    if (!form.position) {
      setError('Please select a position');
      return;
    }

    const selectedPosition = positions.find(p => p.code === form.position);
    if (selectedPosition && currentUser.rating < selectedPosition.requiredRating) {
      const ratingNames = {
        2: 'AS1', 3: 'AS2', 4: 'AS3', 5: 'ADC', 6: 'APC', 7: 'ACC', 8: 'SEC', 9: 'SAI', 10: 'CAI', 11: 'SUP', 12: 'ADM'
      };
      const requiredName = ratingNames[selectedPosition.requiredRating] || `Rating ${selectedPosition.requiredRating}`;
      const yourName = ratingNames[currentUser.rating] || `Rating ${currentUser.rating}`;
      setError(`Insufficient rating! Position requires ${requiredName} but you have ${yourName}`);
      setTimeout(() => setError(''), 5000);
      return;
    }

    if (!form.startDate || !form.startTime || !form.endDate || !form.endTime) {
      setError('All fields required');
      return;
    }
    
    if (!validTime(form.startTime) || !validTime(form.endTime)) {
      setError('Invalid time format (use HH:mm)');
      setTimeout(() => setError(''), 5000);
      return;
    }

    const start = parseUTC(form.startDate, form.startTime);
    const end = parseUTC(form.endDate, form.endTime);
    
    if (!start || !end || isNaN(start.getTime()) || isNaN(end.getTime())) {
      setError('Invalid date/time format');
      setTimeout(() => setError(''), 5000);
      return;
    }
    
    if (start.getFullYear() < 2020 || start.getFullYear() > 2100 || end.getFullYear() < 2020 || end.getFullYear() > 2100) {
      setError('Date must be between 2020 and 2100');
      setTimeout(() => setError(''), 5000);
      return;
    }
    
    if (start < new Date()) {
      setError('Cannot book in the past');
      setTimeout(() => setError(''), 5000);
      return;
    }
    
    if (end <= start) {
      setError('End must be after start');
      setTimeout(() => setError(''), 5000);
      return;
    }

    try {
      const headers = { Authorization: `Bearer ${token}` };
      const payload = {
        position: sanitize(form.position),
        notes: sanitize(form.notes, 200),
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        trainingMode: form.trainingMode,
        examMode: form.examMode,
        noVoice: form.noVoice,
        userVid: currentUser.vid,
        userName: currentUser.vid
      };

      if (editing) {
        await axios.put(`${API_BASE}/bookings/${editing.id}`, payload, { headers, timeout: 10000 });
        setSuccess('Booking updated successfully');
        setEditing(null);
      } else {
        await axios.post(`${API_BASE}/bookings`, payload, { headers, timeout: 10000 });
        setSuccess('Booking created successfully');
      }
      
      setForm({ position: '', notes: '', startDate: '', startTime: '', endDate: '', endTime: '', trainingMode: false, examMode: false, noVoice: false });
      setTimeout(() => setSuccess(''), 3000);
      fetchBookings();
    } catch (err) {
      if (err.code === 'ECONNABORTED') {
        setError('Request timeout - please try again');
      } else if (err.response?.status === 403) {
        setError('Insufficient rating for this position');
      } else if (err.response?.status === 400) {
        setError(err.response?.data?.message || 'Invalid booking data');
      } else {
        setError(err.response?.data?.message || err.message || 'Failed to save booking');
      }
      setTimeout(() => setError(''), 5000);
    }
  };

  const handleEdit = (b) => {
    setEditing(b);
    const s = formatUTC(b.startAt);
    const e = formatUTC(b.endAt);
    setForm({
      position: b.position,
      notes: b.notes || '',
      startDate: s.date,
      startTime: s.time,
      endDate: e.date,
      endTime: e.time,
      trainingMode: b.trainingMode || false,
      examMode: b.examMode || false,
      noVoice: b.noVoice || false
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this booking?')) return;
    
    try {
      await axios.delete(`${API_BASE}/bookings/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000
      });
      setSuccess('Booking deleted successfully');
      setTimeout(() => setSuccess(''), 3000);
      fetchBookings();
    } catch (e) {
      if (e.code === 'ECONNABORTED') {
        setError('Request timeout - booking may still exist');
      } else if (e.response?.status === 403) {
        setError('You can only delete your own bookings');
      } else if (e.response?.status === 404) {
        setError('Booking not found - it may have been already deleted');
      } else {
        setError(e.response?.data?.message || e.message || 'Failed to delete booking');
      }
      setTimeout(() => setError(''), 5000);
    }
  };

  const handleCancelEdit = () => {
    setEditing(null);
    setForm({ 
      position: '', 
      notes: '', 
      startDate: '', 
      startTime: '', 
      endDate: '', 
      endTime: '', 
      trainingMode: false, 
      examMode: false, 
      noVoice: false 
    });
    setError('');
  };

  const filteredPositions = useMemo(() => positions.filter(p => {
    const matchesDivision = !selectedDivision || p.division === selectedDivision;
    const matchesRating = !ratingFilter || p.requiredRating <= parseInt(ratingFilter);
    const matchesSearch = !positionSearch || 
      p.code.toLowerCase().includes(positionSearch.toLowerCase()) ||
      p.name.toLowerCase().includes(positionSearch.toLowerCase());
    return matchesDivision && matchesRating && matchesSearch;
  }), [positions, selectedDivision, ratingFilter, positionSearch]);

  const filteredBookings = useMemo(() => bookings.filter(b => {
    if (selectedDivision && positions.length > 0) {
      const pos = positions.find(p => p.code === b.position);
      return pos && pos.division === selectedDivision;
    }
    return true;
  }), [bookings, positions, selectedDivision]);

  const divisions = useMemo(() => 
    [...new Set(positions.map(p => p.division).filter(Boolean))].sort(),
    [positions]
  );

  const calendarDays = useMemo(() => eachDayOfInterval({
    start: startOfMonth(selectedDate),
    end: endOfMonth(selectedDate)
  }), [selectedDate]);

  const firstDayOfMonth = useMemo(() => startOfMonth(selectedDate), [selectedDate]);
  const startDayOfWeek = useMemo(() => firstDayOfMonth.getDay(), [firstDayOfMonth]);
  const emptyDays = useMemo(() => Array(startDayOfWeek).fill(null), [startDayOfWeek]);

  const getBookingsForDay = useCallback((day) => {
    const dayStart = new Date(day);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(day);
    dayEnd.setHours(23, 59, 59, 999);
    
    return bookings.filter(b => {
      // Only apply division filter if positions are loaded
      if (selectedDivision && positions.length > 0) {
        const pos = positions.find(p => p.code === b.position);
        if (!pos || pos.division !== selectedDivision) return false;
      }
      
      const bookingStart = parseISO(b.startAt);
      const bookingEnd = parseISO(b.endAt);
      return bookingStart < dayEnd && bookingEnd > dayStart;
    });
  }, [bookings, positions, selectedDivision]);

  const getFilteredBookingsByDateRange = useCallback(() => {
    if (dateRange === 'all') {
      return filteredBookings;
    }
    
    const now = new Date();
    const days = dateRange === '7days' ? 7 : dateRange === '30days' ? 30 : 0;
    const endDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    
    return filteredBookings.filter(b => {
      const bookingStart = parseISO(b.startAt);
      return bookingStart <= endDate;
    });
  }, [filteredBookings, dateRange]);

  const getTimelineBookings = useCallback(() => {
    return bookings.filter(b => {
      if (selectedDivision && positions.length > 0) {
        const pos = positions.find(p => p.code === b.position);
        if (!pos || pos.division !== selectedDivision) return false;
      }
      return true;
    });
  }, [bookings, positions, selectedDivision]);

  return (
    <div className="app-container">
      <header className="header">
        <div className="header-left">
          <img 
            src="/IVAO.png" 
            alt="IVAO Logo" 
            className="logo"
          />
          <div className="header-title">
            <h1>IVAO ATC Booking System</h1>
            <p>International Virtual Aviation Organisation</p>
          </div>
        </div>
        <div className="header-right">
          <div className="time-display">
            <span className="time-label">UTC</span>
            <span className="time-value">{getUTCTimeString()}</span>
          </div>
          <div className="auth-section">
          {!token ? (
            <>
              <input
                type="text"
                className="input-field"
                placeholder="Enter your VID"
                value={vidInput}
                onChange={e => setVidInput(sanitize(e.target.value, 20))}
                onKeyPress={e => e.key === 'Enter' && handleLogin()}
                maxLength="20"
              />
              <button className="btn btn-primary" onClick={handleLogin}>
                Login
              </button>
            </>
          ) : (
            <>
              <div className="user-info">
                {currentUser?.name && <span className="user-name">{currentUser.name}</span>}
                <span className="user-vid">VID: {currentUser?.vid}</span>
                {currentUser?.divisionId && <span className="user-division">Division: {currentUser.divisionId}</span>}
                <span className="user-rating">
                  Rating: <span className="rating-level">{currentUser?.ratingLevel || 'NO_RATING'}</span>
                </span>
              </div>
              <button className="btn btn-secondary" onClick={handleLogout}>
                Logout
              </button>
            </>
          )}
          </div>
        </div>
      </header>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="main-content">
        <aside className="card">
          <h2 className="card-title">{editing ? 'Edit Booking' : 'Create Booking'}</h2>
          
          {!token && (
            <div className="alert alert-error" style={{ marginBottom: 20 }}>
              Please login to create bookings
            </div>
          )}



          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Division</label>
              <select 
                value={selectedDivision} 
                onChange={e => setSelectedDivision(e.target.value)}
                disabled={!token}
              >
                <option value="">All Divisions</option>
                {divisions.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Your Rating (Optional Filter)</label>
              <select 
                value={ratingFilter} 
                onChange={e => setRatingFilter(e.target.value)}
                disabled={!token}
              >
                <option value="">All Positions</option>
                <option value="2">AS1 - Student 1</option>
                <option value="3">AS2 - Student 2</option>
                <option value="4">AS3 - Student 3</option>
                <option value="5">ADC - Aerodrome Control</option>
                <option value="6">APC - Approach Control</option>
                <option value="7">ACC - Area Control Center</option>
                <option value="8">SEC - Senior Controller</option>
                <option value="9">SAI - Senior ATC Instructor</option>
                <option value="10">CAI - Chief ATC Instructor</option>
                <option value="11">SUP - Supervisor</option>
                <option value="12">ADM - Administrator</option>
              </select>
            </div>

            <div className="form-group">
              <label>Position *</label>
              <div className="custom-select-wrapper">
                <div 
                  className={`custom-select ${positionDropdown ? 'open' : ''}`}
                  onClick={() => token && setPositionDropdown(!positionDropdown)}
                >
                  <span className={form.position ? '' : 'placeholder'}>
                    {form.position || 'Select or search position'}
                  </span>
                  <span className="arrow">▼</span>
                </div>
                {positionDropdown && (
                  <div className="custom-dropdown">
                    <input
                      type="text"
                      className="dropdown-search"
                      placeholder="Search position..."
                      value={positionSearch}
                      onChange={e => setPositionSearch(e.target.value)}
                      onClick={e => e.stopPropagation()}
                      autoFocus
                    />
                    <div className="dropdown-options">
                      {filteredPositions.length === 0 ? (
                        <div className="dropdown-option disabled">No positions found</div>
                      ) : (
                        filteredPositions.map(p => (
                          <div
                            key={p.id}
                            className={`dropdown-option ${form.position === p.code ? 'selected' : ''}`}
                            onClick={() => {
                              setForm({ ...form, position: p.code });
                              setPositionDropdown(false);
                              setPositionSearch('');
                            }}
                          >
                            <div className="option-code">{p.code}</div>
                            <div className="option-name">{p.name}</div>
                            <div className="option-rating">Min: {RATING_LEVELS[p.requiredRating] || 'AS1'}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Start Date (UTC) *</label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={e => setForm({ ...form, startDate: e.target.value })}
                  required
                  disabled={!token}
                />
              </div>

              <div className="form-group">
                <label>Start Time (UTC) *</label>
                <input
                  type="text"
                  placeholder="14:30"
                  value={form.startTime}
                  onChange={e => {
                    let value = e.target.value.replace(/[^0-9]/g, '');
                    if (value.length >= 2) {
                      value = value.slice(0, 2) + ':' + value.slice(2, 4);
                    }
                    if (value.length <= 5) {
                      setForm({ ...form, startTime: value });
                    }
                  }}
                  maxLength="5"
                  required
                  disabled={!token}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>End Date (UTC) *</label>
                <input
                  type="date"
                  value={form.endDate}
                  onChange={e => setForm({ ...form, endDate: e.target.value })}
                  required
                  disabled={!token}
                />
              </div>

              <div className="form-group">
                <label>End Time (UTC) *</label>
                <input
                  type="text"
                  placeholder="16:00"
                  value={form.endTime}
                  onChange={e => {
                    let value = e.target.value.replace(/[^0-9]/g, '');
                    if (value.length >= 2) {
                      value = value.slice(0, 2) + ':' + value.slice(2, 4);
                    }
                    if (value.length <= 5) {
                      setForm({ ...form, endTime: value });
                    }
                  }}
                  maxLength="5"
                  required
                  disabled={!token}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="mode-label">
                <input
                  type="checkbox"
                  checked={form.trainingMode}
                  onChange={e => setForm({ ...form, trainingMode: e.target.checked })}
                  disabled={!token}
                />
                <span>Training Mode</span>
              </label>
              <label className="mode-label">
                <input
                  type="checkbox"
                  checked={form.examMode}
                  onChange={e => setForm({ ...form, examMode: e.target.checked })}
                  disabled={!token}
                />
                <span>Exam Mode</span>
              </label>
              <label className="mode-label">
                <input
                  type="checkbox"
                  checked={form.noVoice}
                  onChange={e => setForm({ ...form, noVoice: e.target.checked })}
                  disabled={!token}
                />
                <span>No Voice</span>
              </label>
            </div>

            <div className="form-group full-width">
              <label>Notes</label>
              <input
                type="text"
                value={form.notes}
                onChange={e => setForm({ ...form, notes: sanitize(e.target.value, 200) })}
                placeholder="Optional notes"
                disabled={!token}
                maxLength="200"
              />
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button type="submit" className="btn btn-primary" disabled={!token}>
                {editing ? 'Update' : 'Create'}
              </button>
              {editing && (
                <button type="button" className="btn btn-secondary" onClick={handleCancelEdit}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        </aside>

        <main className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 className="card-title" style={{ marginBottom: 0 }}>Bookings</h2>
            <div style={{ display: 'flex', gap: 12 }}>
              <button 
                className={`btn ${viewMode === 'list' ? 'btn-primary' : 'btn-secondary'} btn-small`}
                onClick={() => setViewMode('list')}
              >
                List
              </button>
              <button 
                className={`btn ${viewMode === 'calendar' ? 'btn-primary' : 'btn-secondary'} btn-small`}
                onClick={() => setViewMode('calendar')}
              >
                Calendar
              </button>
              <button 
                className={`btn ${viewMode === 'timeline' ? 'btn-primary' : 'btn-secondary'} btn-small`}
                onClick={() => setViewMode('timeline')}
              >
                Timeline
              </button>
            </div>
          </div>

          <div className="filter-section">
            <label>Filter by Division:</label>
            <select 
              value={selectedDivision} 
              onChange={e => setSelectedDivision(e.target.value)}
            >
              <option value="">All Divisions</option>
              {divisions.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            {selectedDivision && (
              <span className="division-badge">
                {filteredBookings.filter(b => parseISO(b.startAt) >= new Date()).length} bookings
              </span>
            )}
            {viewMode === 'list' && (
              <>
                <label style={{ marginLeft: 20 }}>Date Range:</label>
                <select 
                  value={dateRange} 
                  onChange={e => setDateRange(e.target.value)}
                >
                  <option value="7days">Next 7 Days</option>
                  <option value="30days">Next 30 Days</option>
                  <option value="all">All Future</option>
                </select>
              </>
            )}
          </div>

          {viewMode === 'list' ? (
            <div style={{ overflowX: 'auto' }}>
              {getFilteredBookingsByDateRange().length === 0 ? (
                <div className="empty-state">No bookings found</div>
              ) : (
                <table className="bookings-table">
                  <thead>
                    <tr>
                      <th>Position</th>
                      <th>Start (UTC)</th>
                      <th>End (UTC)</th>
                      <th>VID</th>
                      <th>Mode</th>
                      <th>Notes</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getFilteredBookingsByDateRange().map(b => {
                      const startUTC = parseISO(b.startAt);
                      const endUTC = parseISO(b.endAt);
                      const pos = positions.find(p => p.code === b.position);
                      
                      return (
                        <tr key={b.id}>
                          <td>
                            <span className="position-badge">{b.position}</span>
                            {pos?.division && (
                              <span className="division-badge">{pos.division}</span>
                            )}
                          </td>
                          <td>{format(startUTC, 'MMM dd, HH:mm')}</td>
                          <td>{format(endUTC, 'MMM dd, HH:mm')}</td>
                          <td>{b.userVid}</td>
                          <td>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              {b.trainingMode && <span style={{ background: '#4299e1', color: '#fff', padding: '2px 6px', borderRadius: 3, fontSize: 11, fontWeight: 600 }}>Training</span>}
                              {b.examMode && <span style={{ background: '#ed8936', color: '#fff', padding: '2px 6px', borderRadius: 3, fontSize: 11, fontWeight: 600 }}>Exam</span>}
                              {b.noVoice && <span style={{ background: '#9f7aea', color: '#fff', padding: '2px 6px', borderRadius: 3, fontSize: 11, fontWeight: 600 }}>NoVoice</span>}
                              {!b.trainingMode && !b.examMode && !b.noVoice && <span style={{ color: '#a0aec0' }}>-</span>}
                            </div>
                          </td>
                          <td>{b.notes || '-'}</td>
                          <td>
                            {currentUser && currentUser.vid === b.userVid && (
                              <div className="actions-cell">
                                <button 
                                  className="btn btn-primary btn-small"
                                  onClick={() => handleEdit(b)}
                                >
                                  Edit
                                </button>
                                <button 
                                  className="btn btn-danger btn-small"
                                  onClick={() => handleDelete(b.id)}
                                >
                                  Delete
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          ) : viewMode === 'calendar' ? (
            <div>
              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <button 
                  className="btn btn-secondary btn-small"
                  onClick={() => setSelectedDate(addDays(selectedDate, -30))}
                >
                  ← Previous
                </button>
                <span style={{ margin: '0 20px', fontWeight: 600, fontSize: 18, color: '#cbd5e0' }}>
                  {format(selectedDate, 'MMMM yyyy')}
                </span>
                <button 
                  className="btn btn-secondary btn-small"
                  onClick={() => setSelectedDate(addDays(selectedDate, 30))}
                >
                  Next →
                </button>
              </div>
              
              <div className="calendar-weekdays">
                <div>Sun</div>
                <div>Mon</div>
                <div>Tue</div>
                <div>Wed</div>
                <div>Thu</div>
                <div>Fri</div>
                <div>Sat</div>
              </div>
              
              <div className="calendar-view">
                {emptyDays.map((_, idx) => (
                  <div key={`empty-${idx}`} className="calendar-day calendar-day-empty"></div>
                ))}
                {calendarDays.map(day => {
                  const dayBookings = getBookingsForDay(day);
                  return (
                    <div key={day.toString()} className="calendar-day">
                      <div className="calendar-day-header">
                        {format(day, 'dd')}
                      </div>
                      {dayBookings.slice(0, 3).map(b => (
                        <div 
                          key={b.id} 
                          className="calendar-booking" 
                          title={`${b.position} - ${b.userVid}`}
                          onClick={() => setSelectedDayBookings({ day, bookings: [b] })}
                          style={{ cursor: 'pointer' }}
                        >
                          {b.position}
                        </div>
                      ))}
                      {dayBookings.length > 3 && (
                        <div 
                          style={{ fontSize: 11, color: '#5865f2', marginTop: 4, cursor: 'pointer', textDecoration: 'underline' }}
                          onClick={() => setSelectedDayBookings({ day, bookings: dayBookings })}
                        >
                          +{dayBookings.length - 3} more
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              
              {selectedDayBookings && (
                <div className="modal-overlay" onClick={() => setSelectedDayBookings(null)}>
                  <div className="modal-content" onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                      <h2 style={{ margin: 0 }}>Bookings for {format(selectedDayBookings.day, 'MMMM dd, yyyy')}</h2>
                      <button className="btn btn-secondary btn-small" onClick={() => setSelectedDayBookings(null)}>Close</button>
                    </div>
                    <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                      {selectedDayBookings.bookings.map(b => {
                        const startUTC = parseISO(b.startAt);
                        const endUTC = parseISO(b.endAt);
                        const pos = positions.find(p => p.code === b.position);
                        return (
                          <div key={b.id} style={{ background: '#2c2f3a', padding: 15, borderRadius: 8, marginBottom: 10 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 8 }}>
                              <div>
                                <span className="position-badge">{b.position}</span>
                                {pos?.division && <span className="division-badge">{pos.division}</span>}
                              </div>
                              <div style={{ fontSize: 13, color: '#a0aec0' }}>VID: {b.userVid}</div>
                            </div>
                            <div style={{ fontSize: 13, color: '#cbd5e0', marginBottom: 8 }}>
                              {format(startUTC, 'HH:mm')} - {format(endUTC, 'HH:mm')} UTC
                            </div>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              {b.trainingMode && <span style={{ background: '#4299e1', color: '#fff', padding: '2px 6px', borderRadius: 3, fontSize: 11 }}>Training</span>}
                              {b.examMode && <span style={{ background: '#ed8936', color: '#fff', padding: '2px 6px', borderRadius: 3, fontSize: 11 }}>Exam</span>}
                              {b.noVoice && <span style={{ background: '#9f7aea', color: '#fff', padding: '2px 6px', borderRadius: 3, fontSize: 11 }}>NoVoice</span>}
                            </div>
                            {b.notes && <div style={{ fontSize: 13, color: '#8b8d98', marginTop: 8, fontStyle: 'italic' }}>{b.notes}</div>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : viewMode === 'timeline' ? (
            <div>
              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <button 
                  className="btn btn-secondary btn-small"
                  onClick={() => setTimelineDate(addDays(timelineDate, -1))}
                >
                  ← Previous Day
                </button>
                <span style={{ margin: '0 20px', fontWeight: 600, fontSize: 18, color: '#cbd5e0' }}>
                  {format(timelineDate, 'MMMM dd, yyyy (EEEE)')}
                </span>
                <button 
                  className="btn btn-secondary btn-small"
                  onClick={() => setTimelineDate(addDays(timelineDate, 1))}
                >
                  Next Day →
                </button>
              </div>

              <div className="timeline-container">
                <div className="timeline-header">
                  <div className="timeline-position-label">Position</div>
                  <div className="timeline-hours">
                    {Array.from({ length: 24 }, (_, i) => (
                      <div key={i} className="timeline-hour-label">
                        {String(i).padStart(2, '0')}:00
                      </div>
                    ))}
                  </div>
                </div>

                <div className="timeline-body">
                  {filteredPositions.map(pos => {
                    const posBookings = getTimelineBookings().filter(b => {
                      if (b.position !== pos.code) return false;
                      const bookingStart = parseISO(b.startAt);
                      const bookingEnd = parseISO(b.endAt);
                      const dayStart = new Date(timelineDate);
                      dayStart.setHours(0, 0, 0, 0);
                      const dayEnd = new Date(timelineDate);
                      dayEnd.setHours(23, 59, 59, 999);
                      return bookingStart < dayEnd && bookingEnd > dayStart;
                    });

                    if (posBookings.length === 0) return null;

                    return (
                      <div key={pos.id} className="timeline-row">
                        <div className="timeline-position-cell">
                          <span className="position-badge">{pos.code}</span>
                          <span style={{ fontSize: 11, color: '#8b8d98', display: 'block', marginTop: 2 }}>
                            {pos.name}
                          </span>
                        </div>
                        <div className="timeline-grid">
                          {Array.from({ length: 24 }, (_, i) => (
                            <div key={i} className="timeline-hour-cell"></div>
                          ))}
                          {posBookings.map(b => {
                            const bookingStartUTC = parseISO(b.startAt);
                            const bookingEndUTC = parseISO(b.endAt);
                            const dayStart = new Date(timelineDate);
                            dayStart.setHours(0, 0, 0, 0);
                            const dayEnd = new Date(timelineDate);
                            dayEnd.setHours(23, 59, 59, 999);

                            const effectiveStart = bookingStartUTC < dayStart ? dayStart : bookingStartUTC;
                            const effectiveEnd = bookingEndUTC > dayEnd ? dayEnd : bookingEndUTC;

                            const startHour = effectiveStart.getHours() + effectiveStart.getMinutes() / 60;
                            const endHour = effectiveEnd.getHours() + effectiveEnd.getMinutes() / 60;
                            const duration = endHour - startHour;

                            const leftPercent = (startHour / 24) * 100;
                            const widthPercent = (duration / 24) * 100;

                            return (
                              <div
                                key={b.id}
                                className="timeline-booking"
                                style={{
                                  left: `${leftPercent}%`,
                                  width: `${widthPercent}%`,
                                  background: b.trainingMode ? '#4299e1' : b.examMode ? '#ed8936' : '#5865f2'
                                }}
                                onClick={() => setSelectedDayBookings({ day: timelineDate, bookings: [b] })}
                                title={`${b.position} - ${b.userVid}\nUTC: ${format(bookingStartUTC, 'HH:mm')} - ${format(bookingEndUTC, 'HH:mm')}${b.trainingMode ? '\n📚 Training' : ''}${b.examMode ? '\n✏️ Exam' : ''}${b.noVoice ? '\n🔕 No Voice' : ''}`}
                              >
                                <span className="timeline-booking-text">
                                  {duration >= 1.5 ? (
                                    <>
                                      {format(effectiveStart, 'HH:mm')}-{format(effectiveEnd, 'HH:mm')}
                                      {b.trainingMode && <span style={{ marginLeft: 4, fontSize: 10 }}>📚</span>}
                                      {b.examMode && <span style={{ marginLeft: 4, fontSize: 10 }}>✏️</span>}
                                      {b.noVoice && <span style={{ marginLeft: 4, fontSize: 10 }}>🔕</span>}
                                    </>
                                  ) : (
                                    <>
                                      {b.trainingMode && <span style={{ fontSize: 12 }}>📚</span>}
                                      {b.examMode && <span style={{ fontSize: 12 }}>✏️</span>}
                                      {b.noVoice && <span style={{ fontSize: 12 }}>🔕</span>}
                                      {!b.trainingMode && !b.examMode && !b.noVoice && format(effectiveStart, 'HH:mm')}
                                    </>
                                  )}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}

          {selectedDayBookings && (
            <div className="modal-overlay" onClick={() => setSelectedDayBookings(null)}>
              <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <h2 style={{ margin: 0 }}>Bookings for {format(selectedDayBookings.day, 'MMMM dd, yyyy')}</h2>
                  <button className="btn btn-secondary btn-small" onClick={() => setSelectedDayBookings(null)}>Close</button>
                </div>
                <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                  {selectedDayBookings.bookings.map(b => {
                    const startUTC = parseISO(b.startAt);
                    const endUTC = parseISO(b.endAt);
                    const pos = positions.find(p => p.code === b.position);
                    return (
                      <div key={b.id} style={{ background: '#2c2f3a', padding: 15, borderRadius: 8, marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 8 }}>
                          <div>
                            <span className="position-badge">{b.position}</span>
                            {pos?.division && <span className="division-badge">{pos.division}</span>}
                          </div>
                          <div style={{ fontSize: 13, color: '#a0aec0' }}>VID: {b.userVid}</div>
                        </div>
                        <div style={{ fontSize: 13, color: '#cbd5e0', marginBottom: 8 }}>
                          {format(startUTC, 'HH:mm')} - {format(endUTC, 'HH:mm')} UTC
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {b.trainingMode && <span style={{ background: '#4299e1', color: '#fff', padding: '2px 6px', borderRadius: 3, fontSize: 11 }}>Training</span>}
                          {b.examMode && <span style={{ background: '#ed8936', color: '#fff', padding: '2px 6px', borderRadius: 3, fontSize: 11 }}>Exam</span>}
                          {b.noVoice && <span style={{ background: '#9f7aea', color: '#fff', padding: '2px 6px', borderRadius: 3, fontSize: 11 }}>NoVoice</span>}
                        </div>
                        {b.notes && <div style={{ fontSize: 13, color: '#8b8d98', marginTop: 8, fontStyle: 'italic' }}>{b.notes}</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
