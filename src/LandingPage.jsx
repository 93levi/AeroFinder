import { useState, useEffect, useRef } from 'react';
import { Map, Marker } from 'pigeon-maps';
import BuildingScene from './BuildingScene';
import RentalModal from './RentalModal';
import './LandingPage.css';

const API               = import.meta.env.VITE_API_BASE || (import.meta.env.PROD ? 'https://aerofinder-6kat.onrender.com' : '/api');
const BUILDING_CAPACITY = 36;   // rental windows on the right face (ROWS=18 × COLS_R=2)
const API_BATCH         = 4;    // API pages fetched per building block
const MAX_API_PAGES     = 48;   // safety cap — prevents infinite loops on bad API responses

export default function LandingPage() {

  // UI state
  const [ready,            setReady]            = useState(false);
  const [browseMode,       setBrowseMode]       = useState(false);
  const [viewMode,         setViewMode]         = useState('building'); // 'building' | 'table'
  const [showFilters,      setShowFilters]      = useState(false);
  const [noResults,        setNoResults]        = useState(false);

  // Rental data
  const [rentals,          setRentals]          = useState([]);
  const [selectedRental,   setSelectedRental]   = useState(null);
  const [modalRentalId,    setModalRentalId]    = useState(null);
  const [loadingSearch,    setLoadingSearch]    = useState(false);
  const [detailLoading,    setDetailLoading]    = useState(false);
  const [loadingPage,      setLoadingPage]      = useState(false);

  // Pagination
  const [currentBlock,     setCurrentBlock]     = useState(1);
  const [hasNextBlock,     setHasNextBlock]     = useState(false);
  const [totalResults,     setTotalResults]     = useState(0); // My Ratings count
  const [myRatingsMode,    setMyRatingsMode]    = useState(false);
  const [myRatingsLoading, setMyRatingsLoading] = useState(false);

  // Auth
  const [isLoggedIn,       setIsLoggedIn]       = useState(!!localStorage.getItem('token'));
  const [authMode,         setAuthMode]         = useState(null); // null | 'login' | 'register'
  const [authEmail,        setAuthEmail]        = useState('');
  const [authPassword,     setAuthPassword]     = useState('');
  const [authFirst,        setAuthFirst]        = useState('');
  const [authLast,         setAuthLast]         = useState('');
  const [authLoading,      setAuthLoading]      = useState(false);
  const [authError,        setAuthError]        = useState(null);

  // Ratings
  const [ratings,          setRatings]          = useState([]);
  const [userRating,       setUserRating]       = useState(0);
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [ratingError,      setRatingError]      = useState(null);
  const [ratingSuccess,    setRatingSuccess]    = useState(false);

  // Filters
  const [states,           setStates]           = useState([]);
  const [propTypes,        setPropTypes]        = useState([]);
  const [filterState,      setFilterState]      = useState('');
  const [filterType,       setFilterType]       = useState('');
  const [filterMinRent,    setFilterMinRent]    = useState('');
  const [filterMaxRent,    setFilterMaxRent]    = useState('');
  const [filterBeds,       setFilterBeds]       = useState('');
  const [filterSort,       setFilterSort]       = useState('');

  // Refs
  // Store active filter params so pagination stays consistent with the current search
  const activeFilterStrRef     = useRef('');
  const activeClientFiltersRef = useRef({});
  // Maps block number to starting API page for correct Prev navigation
  const blockApiStartRef       = useRef({ 1: 1 });
  // Page-turn animation refs (shared with BuildingScene)
  const pageTurnRef            = useRef(false); // signal: start swing back to front
  const pageTurnReadyRef       = useRef(false); // signal: new data loaded, swing to side

  function openModal(id) {
    window.history.pushState({ modal: true }, '', `/rentals/${id}`);
    setModalRentalId(id);
  }

  function closeModal() {
    window.history.back();
    setModalRentalId(null);
  }

  function openAuth(mode) {
    setAuthMode(mode);
    setAuthEmail(''); setAuthPassword('');
    setAuthFirst(''); setAuthLast('');
    setAuthError(null);
  }
  function closeAuth() { setAuthMode(null); setAuthError(null); }

  async function handleAuthSubmit(e) {
    e.preventDefault();
    if (authLoading) return;
    setAuthLoading(true); setAuthError(null);
    try {
      const body = authMode === 'login'
        ? { email: authEmail, password: authPassword }
        : { email: authEmail, password: authPassword, firstName: authFirst, lastName: authLast };
      const res  = await fetch(`${API}/user/${authMode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `${authMode} failed`);
      localStorage.setItem('token', data.token);
      setIsLoggedIn(true);
      closeAuth();
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  }

  // Fetch filter options on mount
  useEffect(() => {
    fetch(`${API}/rentals/states`)
      .then(r => r.json()).then(setStates).catch(() => {});
    fetch(`${API}/rentals/property-types`)
      .then(r => r.json()).then(setPropTypes).catch(() => {});
  }, []);

  function handleLogout() {
    localStorage.removeItem('token');
    setIsLoggedIn(false);
  }

  async function handleSelectRental(rental) {
    // Reset rating state for new selection
    setRatings([]);
    setUserRating(0);
    setRatingError(null);
    setRatingSuccess(false);

    // Show panel immediately with search-level data
    setSelectedRental(rental);
    setDetailLoading(true);

    try {
      // Fetch full detail and ratings in parallel
      const token = localStorage.getItem('token');
      const [detailRes, ratingsRes] = await Promise.all([
        fetch(`${API}/rentals/${rental.id}`),
        token
          ? fetch(`${API}/ratings/rentals/${rental.id}`, {
              headers: { 'Authorization': `Bearer ${token}` },
            })
          : Promise.resolve(null),
      ]);

      const full = await detailRes.json();
      if (detailRes.ok) setSelectedRental({ ...full, id: rental.id });

      if (ratingsRes && ratingsRes.ok) {
        const rData = await ratingsRes.json();
        setRatings(rData ?? []);
      }
    } catch {
      // keep shallow data if fetch fails
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleSubmitRating() {
    if (!userRating || ratingSubmitting) return;
    setRatingSubmitting(true);
    setRatingError(null);
    setRatingSuccess(false);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/ratings/rentals/${selectedRental.id}`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ rating: userRating }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Could not submit rating');
      setRatingSuccess(true);
      // Refresh ratings list
      const r2 = await fetch(`${API}/ratings/rentals/${selectedRental.id}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (r2.ok) setRatings((await r2.json()) ?? []);
    } catch (err) {
      setRatingError(err.message);
    } finally {
      setRatingSubmitting(false);
    }
  }

  // Build query string from active filters + sort
  function buildFilterParams() {
    const p = new URLSearchParams();
    if (filterState)   p.set('state',        filterState);
    if (filterType)    p.set('propertyType',  filterType);
    if (filterMinRent) p.set('minRent',       filterMinRent);
    if (filterMaxRent) p.set('maxRent',       filterMaxRent);
    if (filterBeds)    p.set('bedrooms',      filterBeds);
    if (filterSort) {
      const [sortBy, sortOrder] = filterSort.split('_');
      p.set('sortBy',    sortBy);
      p.set('sortOrder', sortOrder);
    }
    return p.toString() ? `&${p.toString()}` : '';
  }

  // Apply client-side filters on top of API results
  function applyClientFilters(rentals, { minRent, maxRent, beds, state, type } = {}) {
    return rentals.filter(r => {
      if (state   && r.state?.toLowerCase() !== state.toLowerCase()) return false;
      if (type    && r.propertyType !== type)                         return false;
      if (minRent && Number(r.rent) < Number(minRent))               return false;
      if (maxRent && Number(r.rent) > Number(maxRent))               return false;
      if (beds    && Number(r.bedrooms) < Number(beds))              return false;
      return true;
    });
  }

  // Fetch API pages until the building is full, returns results and next page
  async function fetchFromApiPage(startApiPage, filterStr, clientFilters = {}) {
    const hasClientFilters = Object.values(clientFilters).some(v => v !== '');

    let filtered    = [];
    let apiPage     = startApiPage;
    let hasNext     = false;
    let apiLastPage = null; // last API page number (respects search filters)

    while (filtered.length < BUILDING_CAPACITY && apiPage < startApiPage + MAX_API_PAGES) {
      const responses = await Promise.all(
        Array.from({ length: API_BATCH }, (_, i) =>
          fetch(`${API}/rentals/search?page=${apiPage + i}${filterStr}`, { cache: 'no-store' })
            .then(r => r.ok ? r.json() : { data: [], pagination: {} })
        )
      );

      // Capture pagination metadata on first batch only
      if (apiLastPage === null) {
        const pag   = responses[0]?.pagination ?? {};
        // lastPage reflects the filtered result count; total is often the global unfiltered count
        apiLastPage = pag.lastPage ?? null;
      }

      const raw  = responses.flatMap(d => d.data ?? []);
      const kept = hasClientFilters ? applyClientFilters(raw, clientFilters) : raw;
      filtered   = [...filtered, ...kept];

      apiPage += API_BATCH;

      // Determine whether more pages exist beyond this batch
      if (apiLastPage != null) {
        hasNext = apiPage <= apiLastPage;
      } else {
        // Fallback: check if the last fetched page returned any items
        hasNext = (responses[API_BATCH - 1]?.data ?? []).length > 0;
      }

      if (!hasNext) break;
      // Without client-side filtering a single batch always fills the building
      if (!hasClientFilters) break;
    }

    // Prefer lastPage-based count (accurate for filtered searches)
    const estTotalBlocks = apiLastPage != null
      ? Math.ceil(apiLastPage / API_BATCH)
      : null;

    return {
      combined:        filtered.slice(0, BUILDING_CAPACITY),
      hasNext:         hasNext || filtered.length > BUILDING_CAPACITY,
      nextApiPage:     apiPage,
      estTotalBlocks,
    };
  }

  // Resolve starting API page for a block and store the next block's start
  async function fetchBlock(block, filterStr, clientFilters = {}) {
    const startApiPage = blockApiStartRef.current[block] ?? 1;
    const result = await fetchFromApiPage(startApiPage, filterStr, clientFilters);
    // Store start page for next block
    blockApiStartRef.current[block + 1] = result.nextApiPage;
    return result;
  }

  // Run search with current filters
  async function runSearch(filterStr, clientFilters = {}) {
    if (loadingSearch) return;
    setLoadingSearch(true);
    setNoResults(false);
    // Reset block map for new search
    blockApiStartRef.current = { 1: 1 };
    try {
      const { combined, hasNext } = await fetchBlock(1, filterStr, clientFilters);
      if (combined.length === 0) {
        setNoResults(true);
        return;
      }
      activeFilterStrRef.current     = filterStr;
      activeClientFiltersRef.current = clientFilters;

      setShowFilters(false);
      setRentals(combined);
      setCurrentBlock(1);
      setHasNextBlock(hasNext);
      setBrowseMode(true);
    } catch {
      // silent fail
    } finally {
      setLoadingSearch(false);
    }
  }

  // Load user's rated properties into the building
  async function handleMyRatings() {
    if (myRatingsLoading) return;
    setMyRatingsLoading(true);
    setShowFilters(false);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/ratings`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load ratings');
      const data = await res.json();
      const rows = data.data ?? data ?? [];

      // Fetch full rental details for each rated property
      const ids = [...new Set(rows.map(r => r.rentalId).filter(Boolean))];
      const details = await Promise.all(
        ids.map(id =>
          fetch(`${API}/rentals/${id}`)
            .then(r => r.ok ? r.json() : null)
            .catch(() => null)
        )
      );

      // Merge user's rating onto each rental object
      const ratingMap = {};
      rows.forEach(r => { ratingMap[r.rentalId] = r.rating; });
      const merged = details
        .filter(Boolean)
        .map((d, i) => ({ ...d, id: ids[i], userRating: ratingMap[ids[i]] }));

      setRentals(merged);
      setMyRatingsMode(true);
      setBrowseMode(true);
      setCurrentBlock(1);
      setTotalResults(merged.length);
    } catch {
      // silent fail
    } finally {
      setMyRatingsLoading(false);
    }
  }

  // Search with current filters applied
  function buildClientFilters() {
    return {
      state:   filterState,
      type:    filterType,
      minRent: filterMinRent,
      maxRent: filterMaxRent,
      beds:    filterBeds,
    };
  }

  function handleSearchClick() {
    runSearch(buildFilterParams(), buildClientFilters());
  }

  // Clear all filters and browse everything
  function handleSeeAll() {
    setFilterState(''); setFilterType(''); setFilterMinRent('');
    setFilterMaxRent(''); setFilterBeds(''); setFilterSort('');
    runSearch('', {});
  }

  // Handle page forward/back
  async function handlePageChange(direction) {
    const nextBlock = currentBlock + direction;
    if (nextBlock < 1) return;
    if (direction > 0 && !hasNextBlock) return; // no more pages

    setLoadingPage(true);
    setSelectedRental(null);
    pageTurnRef.current = true;

    try {
      // Use stored filter params from the active search
      const { combined, hasNext } = await fetchBlock(
        nextBlock,
        activeFilterStrRef.current,
        activeClientFiltersRef.current
      );

      if (combined.length === 0) {
        // No results after client filtering, stop
        setHasNextBlock(false);
        pageTurnReadyRef.current = true;
        return;
      }

      setRentals(combined);
      setCurrentBlock(nextBlock);
      setHasNextBlock(hasNext);
      pageTurnReadyRef.current = true;
    } catch {
      pageTurnReadyRef.current = true;
    } finally {
      setLoadingPage(false);
    }
  }

  function exitBrowse() {
    setBrowseMode(false);
    setMyRatingsMode(false);
    setSelectedRental(null);
    setViewMode('building');
    blockApiStartRef.current = { 1: 1 };
  }

  return (
    <div className="landing-root">

      {/* 3D scene */}
      <div className="landing-scene">
        <BuildingScene
          style={{ width: '100%', height: '100%' }}
          onReady={() => setReady(true)}
          pageTurnRef={pageTurnRef}
          pageTurnReadyRef={pageTurnReadyRef}
          browseMode={browseMode}
          rentals={rentals}
          onSelectRental={handleSelectRental}
        />
      </div>

      {/* UI */}
      {browseMode && (
        <div className="browse-ui">

          {/* Back + Pagination stacked top-left */}
          <div className="browse-nav">
            <button className="browse-back" onClick={exitBrowse}>Back</button>
            {myRatingsMode ? (
              <span className="page-indicator">My Ratings · {totalResults}</span>
            ) : (
              <>
                <span className="page-indicator">
                  {loadingPage ? '…' : `Page ${currentBlock}`}
                </span>
                {viewMode === 'building' && (
                  <>
                    <button
                      className="page-btn"
                      onClick={() => handlePageChange(1)}
                      disabled={!hasNextBlock || loadingPage}
                    >Next</button>
                    <button
                      className="page-btn"
                      onClick={() => handlePageChange(-1)}
                      disabled={currentBlock <= 1 || loadingPage}
                    >Prev</button>
                  </>
                )}
              </>
            )}

            {/* View toggle */}
            <div className="view-toggle">
              <button
                className={`view-toggle-btn ${viewMode === 'building' ? 'view-toggle-active' : ''}`}
                onClick={() => setViewMode('building')}
              >Aero</button>
              <button
                className={`view-toggle-btn ${viewMode === 'table' ? 'view-toggle-active' : ''}`}
                onClick={() => { setViewMode('table'); setSelectedRental(null); }}
              >Table</button>
            </div>
          </div>

          {/* Full-screen table view */}
          {viewMode === 'table' && (
            <div className="table-fullscreen">

              <div className="table-fs-header">
                <button className="browse-back" onClick={exitBrowse}>Back</button>
                <div className="table-fs-left">
                  <h1 className="table-fs-title">
                    {myRatingsMode ? 'My Ratings' : 'Search Results'}
                  </h1>
                  <span className="table-fs-sub">
                    {myRatingsMode
                      ? `${totalResults} rated propert${totalResults !== 1 ? 'ies' : 'y'}`
                      : `Page ${currentBlock}`}
                  </span>
                </div>
                <div className="view-toggle">
                  <button className="view-toggle-btn" onClick={() => { setViewMode('building'); setSelectedRental(null); }}>Aero</button>
                  <button className="view-toggle-btn view-toggle-active">Table</button>
                </div>
              </div>

              <div className="table-fs-body">
                <div className="table-fs-wrap">
                  <table className="browse-table">
                    <thead>
                      <tr>
                        <th>Property</th>
                        <th>Type</th>
                        <th>State</th>
                        <th>Suburb</th>
                        <th>Beds</th>
                        <th>Bath</th>
                        <th>Rent/wk</th>
                        {myRatingsMode && <th>Your Rating</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {rentals.map((r, i) => (
                        <tr
                          key={i}
                          className={`browse-table-row${selectedRental?.id === r.id ? ' browse-table-row-active' : ''}`}
                          onClick={() => handleSelectRental(r)}
                        >
                          <td>{r.title}</td>
                          <td>{r.propertyType}</td>
                          <td>{r.state}</td>
                          <td>{r.suburb}</td>
                          <td>{r.bedrooms}</td>
                          <td>{r.bathrooms}</td>
                          <td>${r.rent}</td>
                          {myRatingsMode && (
                            <td className="browse-table-stars">
                              {'★'.repeat(r.userRating)}{'☆'.repeat(5 - (r.userRating || 0))}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {!myRatingsMode && (
                    <div className="table-pagination">
                      <button className="mr-page-btn" onClick={() => handlePageChange(-1)} disabled={currentBlock <= 1 || loadingPage}>Prev</button>
                      <span className="mr-page-indicator">{loadingPage ? '…' : `Page ${currentBlock}`}</span>
                      <button className="mr-page-btn" onClick={() => handlePageChange(1)} disabled={!hasNextBlock || loadingPage}>Next</button>
                    </div>
                  )}
                </div>

                {/* Detail panel */}
                {selectedRental && (
                  <div className="table-detail-panel">
                    <button className="detail-close" onClick={() => setSelectedRental(null)}>×</button>
                    <div className="detail-type-badge">{selectedRental.propertyType}</div>
                    <h2 className="detail-title">{selectedRental.title}</h2>
                    <p className="detail-address">
                      {selectedRental.streetAddress ? `${selectedRental.streetAddress}, ` : ''}
                      {selectedRental.suburb}, {selectedRental.state} {selectedRental.postcode}
                    </p>
                    {selectedRental.agencyName && <p className="detail-agency">{selectedRental.agencyName}</p>}
                    {selectedRental.latitude && selectedRental.longitude && (
                      <div className="detail-map">
                        <Map height={130} defaultCenter={[selectedRental.latitude, selectedRental.longitude]} defaultZoom={14} attribution={false}>
                          <Marker width={32} anchor={[selectedRental.latitude, selectedRental.longitude]} color="#44dd44" />
                        </Map>
                      </div>
                    )}
                    <div className="detail-price">
                      <span className="detail-price-num">${selectedRental.rent}</span>
                      <span className="detail-price-label">/week</span>
                    </div>
                    <div className="detail-stats">
                      <div className="detail-stat"><span className="stat-val">{selectedRental.bedrooms}</span><span className="stat-lbl">bed</span></div>
                      <div className="detail-stat"><span className="stat-val">{selectedRental.bathrooms}</span><span className="stat-lbl">bath</span></div>
                      <div className="detail-stat"><span className="stat-val">{selectedRental.parkingSpaces}</span><span className="stat-lbl">parking</span></div>
                    </div>
                    {selectedRental.averageRating != null && (
                      <div className="detail-rating">
                        {selectedRental.averageRating.toFixed(1)}
                        <span className="detail-rating-count">({selectedRental.numRatings} review{selectedRental.numRatings !== 1 ? 's' : ''})</span>
                      </div>
                    )}
                    {myRatingsMode && selectedRental.userRating && (
                      <div className="table-your-rating">
                        <span className="ratings-label">Your rating</span>
                        <span className="browse-table-stars">{'★'.repeat(selectedRental.userRating)}{'☆'.repeat(5 - selectedRental.userRating)}</span>
                      </div>
                    )}
                    {selectedRental.description && (
                      <p className="detail-description">{selectedRental.description.replace(/<[^>]*>/g, ' ').trim()}</p>
                    )}
                    {detailLoading && <p className="detail-loading">Loading…</p>}

                    <button className="detail-fullpage" onClick={() => openModal(selectedRental.id)}>View full page</button>

                    {/* Ratings section */}
                    {isLoggedIn && !detailLoading && (
                      <div className="ratings-section">
                        <div className="ratings-divider" />
                        {!ratingSuccess && (
                          <>
                            <p className="ratings-label">Rate this property</p>
                            <div className="star-row">
                              {[1,2,3,4,5].map(n => (
                                <button
                                  key={n}
                                  className={`star-btn ${userRating >= n ? 'star-active' : ''}`}
                                  onClick={() => setUserRating(n)}
                                >
                                  {userRating >= n ? '★' : '☆'}
                                </button>
                              ))}
                            </div>
                            {ratingError && <p className="rating-error">{ratingError}</p>}
                            <button
                              className="rating-submit"
                              onClick={handleSubmitRating}
                              disabled={!userRating || ratingSubmitting}
                            >
                              {ratingSubmitting ? 'Submitting…' : 'Submit Rating'}
                            </button>
                          </>
                        )}
                        {ratingSuccess && <p className="rating-success">Rating submitted</p>}
                        {ratings.length > 0 && (
                          <div className="ratings-list">
                            {ratings.slice(0, 5).map((r, i) => (
                              <div key={i} className="rating-row">
                                <span className="rating-stars">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    {!isLoggedIn && !detailLoading && (
                      <p className="ratings-login-prompt">
                        <button className="ratings-login-link" onClick={() => { exitBrowse(); openAuth('login'); }}>Login</button> to rate this property
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}


          {/* Detail panel */}
          {selectedRental && (
            <div className="detail-panel">
              <button className="detail-close" onClick={() => setSelectedRental(null)}>×</button>

              <div className="detail-type-badge">{selectedRental.propertyType}</div>
              <h2 className="detail-title">{selectedRental.title}</h2>

              {/* Street address appears once full data loads */}
              <p className="detail-address">
                {selectedRental.streetAddress
                  ? `${selectedRental.streetAddress}, `
                  : ''}
                {selectedRental.suburb}, {selectedRental.state} {selectedRental.postcode}
              </p>

              {selectedRental.agencyName && (
                <p className="detail-agency">{selectedRental.agencyName}</p>
              )}

              {/* Map — only renders once lat/lng available from full detail fetch */}
              {selectedRental.latitude && selectedRental.longitude && (
                <div className="detail-map">
                  <Map
                    height={140}
                    defaultCenter={[selectedRental.latitude, selectedRental.longitude]}
                    defaultZoom={14}
                    attribution={false}
                  >
                    <Marker
                      width={32}
                      anchor={[selectedRental.latitude, selectedRental.longitude]}
                      color="#44dd44"
                    />
                  </Map>
                </div>
              )}

              <div className="detail-price">
                <span className="detail-price-num">${selectedRental.rent}</span>
                <span className="detail-price-label">/week</span>
              </div>

              <div className="detail-stats">
                <div className="detail-stat">
                  <span className="stat-val">{selectedRental.bedrooms}</span>
                  <span className="stat-lbl">bed</span>
                </div>
                <div className="detail-stat">
                  <span className="stat-val">{selectedRental.bathrooms}</span>
                  <span className="stat-lbl">bath</span>
                </div>
                <div className="detail-stat">
                  <span className="stat-val">{selectedRental.parkingSpaces}</span>
                  <span className="stat-lbl">parking</span>
                </div>
              </div>

              {selectedRental.averageRating != null && (
                <div className="detail-rating">
                  {selectedRental.averageRating.toFixed(1)}
                  <span className="detail-rating-count">
                    ({selectedRental.numRatings} review{selectedRental.numRatings !== 1 ? 's' : ''})
                  </span>
                </div>
              )}

              {/* Description loads in once full detail is fetched */}
              {selectedRental.description && (
                <p className="detail-description">
                  {selectedRental.description.replace(/<[^>]*>/g, ' ').trim()}
                </p>
              )}

              {detailLoading && <p className="detail-loading">Loading…</p>}

              <button className="detail-fullpage" onClick={() => openModal(selectedRental.id)}>View full page</button>

              {/* Ratings */}
              {isLoggedIn && !detailLoading && (
                <div className="ratings-section">
                  <div className="ratings-divider" />

                  {/* Star submit */}
                  {!ratingSuccess && (
                    <>
                      <p className="ratings-label">Rate this property</p>
                      <div className="star-row">
                        {[1,2,3,4,5].map(n => (
                          <button
                            key={n}
                            className={`star-btn ${userRating >= n ? 'star-active' : ''}`}
                            onClick={() => setUserRating(n)}
                          >
                            {userRating >= n ? '★' : '☆'}
                          </button>
                        ))}
                      </div>
                      {ratingError && <p className="rating-error">{ratingError}</p>}
                      <button
                        className="rating-submit"
                        onClick={handleSubmitRating}
                        disabled={!userRating || ratingSubmitting}
                      >
                        {ratingSubmitting ? 'Submitting…' : 'Submit Rating'}
                      </button>
                    </>
                  )}

                  {ratingSuccess && (
                    <p className="rating-success">Rating submitted</p>
                  )}

                  {/* Individual ratings list */}
                  {ratings.length > 0 && (
                    <div className="ratings-list">
                      {ratings.slice(0, 5).map((r, i) => (
                        <div key={i} className="rating-row">
                          <span className="rating-stars">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {!isLoggedIn && !detailLoading && (
                <p className="ratings-login-prompt">
                  <button className="ratings-login-link" onClick={() => { exitBrowse(); openAuth('login'); }}>Login</button> to rate this property
                </p>
              )}

            </div>
          )}
        </div>
      )}

      {/* Landing Panel */}
      {!browseMode && (
        <div className={`landing-panel ${ready ? 'panel-visible' : ''} ${showFilters || authMode ? 'panel-search-mode' : ''}`}>

          {authMode ? (
            /* Auth view */
            <div className="search-view">
              <button className="filter-back" onClick={closeAuth}>Back</button>
              <h2 className="auth-inline-title">{authMode === 'login' ? 'Sign in' : 'Sign up'}</h2>
              <form className="auth-inline-form" onSubmit={handleAuthSubmit}>
                {authMode === 'register' && (
                  <>
                    <div className="auth-inline-field">
                      <label className="filter-label">First name</label>
                      <input className="filter-input" type="text" value={authFirst} onChange={e => setAuthFirst(e.target.value)} required autoComplete="given-name" />
                    </div>
                    <div className="auth-inline-field">
                      <label className="filter-label">Last name</label>
                      <input className="filter-input" type="text" value={authLast} onChange={e => setAuthLast(e.target.value)} required autoComplete="family-name" />
                    </div>
                  </>
                )}
                <div className="auth-inline-field">
                  <label className="filter-label">Email</label>
                  <input className="filter-input" type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} required autoComplete="email" />
                </div>
                <div className="auth-inline-field">
                  <label className="filter-label">Password</label>
                  <input className="filter-input" type="password" value={authPassword} onChange={e => setAuthPassword(e.target.value)} required autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} />
                </div>
                {authError && <p className="auth-inline-error">{authError}</p>}
                <button className="filter-search-btn filter-search-centered" type="submit" disabled={authLoading}>
                  {authLoading ? '…' : authMode === 'login' ? 'Sign in' : 'Create account'}
                </button>
              </form>
              <button className="auth-inline-switch" onClick={() => openAuth(authMode === 'login' ? 'register' : 'login')}>
                {authMode === 'login' ? 'No account? Sign up' : 'Have an account? Sign in'}
              </button>
            </div>
          ) : !showFilters ? (
            /* Default view */
            <>
              <div className="landing-brand">
                <h1 className="landing-title">AeroFinder</h1>
                <p className="landing-sub">Find your new home today with our new <span style={{textTransform:'none'}}>©AeroView</span> experience</p>
              </div>

              <nav className="landing-nav">
                <button className="landing-btn btn-search" onClick={() => setShowFilters(true)}>
                  Search
                </button>
                {isLoggedIn ? (
                  <div className="landing-auth-row">
                    <button className="landing-btn btn-auth" onClick={handleMyRatings} disabled={myRatingsLoading}>
                      {myRatingsLoading ? '…' : 'My Ratings'}
                    </button>
                    <button className="landing-btn btn-auth" onClick={handleLogout}>Logout</button>
                  </div>
                ) : (
                  <div className="landing-auth-row">
                    <button className="landing-btn btn-auth" onClick={() => openAuth('login')}>Sign In</button>
                    <button className="landing-btn btn-auth" onClick={() => openAuth('register')}>Sign Up</button>
                  </div>
                )}
              </nav>

              <span className="landing-copy">© AeroFinder</span>
              <p className="landing-atsi">
                AeroFinder acknowledges the Traditional Custodians of the many Countries across Australia on which our users seek and find home. We pay our respects to Elders past, present and emerging.
              </p>
            </>
          ) : (
            /* Search view */
            <div className="search-view">

              <button className="filter-back" onClick={() => setShowFilters(false)}>Back</button>

              {/* Option 1: Browse All */}
              <button
                className="search-option-btn"
                onClick={handleSeeAll}
                disabled={loadingSearch}
              >
                {loadingSearch ? 'Loading…' : 'Browse All'}
              </button>

              {/* Divider */}
              <div className="search-or-row">
                <div className="search-or-line" />
                <span className="search-or-label">or</span>
                <div className="search-or-line" />
              </div>

              {/* Option 2: Filtered search */}
              <div className="search-option-block">
                <div className="filter-fields">
                  <div className="filter-row">
                    <div className="filter-field">
                      <label className="filter-label">State</label>
                      <select className="filter-select" value={filterState} onChange={e => setFilterState(e.target.value)}>
                        <option value="">All states</option>
                        {states.map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
                      </select>
                    </div>
                    <div className="filter-field">
                      <label className="filter-label">Type</label>
                      <select className="filter-select" value={filterType} onChange={e => setFilterType(e.target.value)}>
                        <option value="">All types</option>
                        {propTypes.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="filter-row">
                    <div className="filter-field">
                      <label className="filter-label">Min rent</label>
                      <input className="filter-input" type="number" placeholder="$0" value={filterMinRent} onChange={e => setFilterMinRent(e.target.value)} />
                    </div>
                    <div className="filter-field">
                      <label className="filter-label">Max rent</label>
                      <input className="filter-input" type="number" placeholder="Any" value={filterMaxRent} onChange={e => setFilterMaxRent(e.target.value)} />
                    </div>
                  </div>
                  <div className="rent-presets">
                    {[
                      { label: 'Under $500',   min: '',     max: '500'  },
                      { label: '$500 – $1000', min: '500',  max: '1000' },
                      { label: 'Over $1000',   min: '1000', max: ''     },
                    ].map(p => (
                      <button
                        key={p.label}
                        className={`rent-preset-btn${filterMinRent === p.min && filterMaxRent === p.max ? ' rent-preset-active' : ''}`}
                        onClick={() => { setFilterMinRent(p.min); setFilterMaxRent(p.max); }}
                      >{p.label}</button>
                    ))}
                  </div>
                  <div className="filter-row">
                    <div className="filter-field">
                      <label className="filter-label">Bedrooms</label>
                      <select className="filter-select" value={filterBeds} onChange={e => setFilterBeds(e.target.value)}>
                        <option value="">Any</option>
                        {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}+</option>)}
                      </select>
                    </div>
                    <div className="filter-field">
                      <label className="filter-label">Sort by</label>
                      <select className="filter-select" value={filterSort} onChange={e => setFilterSort(e.target.value)}>
                        <option value="">Default</option>
                        <option value="rent_asc">Price: Low → High</option>
                        <option value="rent_desc">Price: High → Low</option>
                        <option value="bedrooms_asc">Beds: Fewest first</option>
                        <option value="bedrooms_desc">Beds: Most first</option>
                      </select>
                    </div>
                  </div>
                </div>

                {noResults && (
                  <p className="filter-no-results">No matches — try different filters</p>
                )}
                <div className="filter-actions">
                  <button className="filter-clear" onClick={() => { setFilterState(''); setFilterType(''); setFilterMinRent(''); setFilterMaxRent(''); setFilterBeds(''); setFilterSort(''); setNoResults(false); }}>
                    Clear filters
                  </button>
                  <button
                    className="filter-search-btn filter-search-centered"
                    onClick={handleSearchClick}
                    disabled={loadingSearch}
                  >
                    {loadingSearch ? 'Loading…' : 'Search'}
                  </button>
                </div>
              </div>

            </div>
          )}

        </div>
      )}

      {/* Rental detail modal */}
      {modalRentalId && (
        <RentalModal
          rentalId={modalRentalId}
          onClose={closeModal}
        />
      )}


    </div>
  );
}
