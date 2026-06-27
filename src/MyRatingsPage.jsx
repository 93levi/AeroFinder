import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Map, Marker } from 'pigeon-maps';
import './MyRatingsPage.css';

const API = '/api';

export default function MyRatingsPage() {
  const navigate = useNavigate();

  const [ratings,       setRatings]       = useState([]);
  const [rentals,       setRentals]       = useState({});   // id -> rental detail
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);
  const [selected,      setSelected]      = useState(null); // selected rental object
  const [page,          setPage]          = useState(1);
  const [totalPages,    setTotalPages]    = useState(1);

  const PAGE_SIZE = 10;

  // Redirect if not logged in
  useEffect(() => {
    if (!localStorage.getItem('token')) navigate('/login');
  }, [navigate]);

  // Fetch ratings page
  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      setSelected(null);
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API}/ratings?page=${page}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Failed to load ratings');
        const data = await res.json();

        const rows   = data.data          ?? data ?? [];
        const total  = data.pagination?.total ?? rows.length;
        setRatings(rows);
        setTotalPages(Math.max(1, Math.ceil(total / PAGE_SIZE)));

        // Fetch rental details for each rating
        const ids = [...new Set(rows.map(r => r.rentalId).filter(Boolean))];
        const details = await Promise.all(
          ids.map(id =>
            fetch(`${API}/rentals/${id}`)
              .then(r => r.ok ? r.json() : null)
              .catch(() => null)
          )
        );
        const map = {};
        details.forEach((d, i) => { if (d) map[ids[i]] = { ...d, id: ids[i] }; });
        setRentals(prev => ({ ...prev, ...map }));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [page]);

  const stars = n => '★'.repeat(n) + '☆'.repeat(5 - n);

  return (
    <div className="mr-root">

      {/* Header */}
      <div className="mr-header">
        <Link to="/" className="mr-back">← Back</Link>
        <h1 className="mr-title">My Ratings</h1>
        <span className="mr-sub">Properties you've reviewed</span>
      </div>

      <div className="mr-body">

        {/* Table */}
        <div className="mr-table-wrap">
          {loading && <p className="mr-status">Loading…</p>}
          {error   && <p className="mr-status mr-error">{error}</p>}
          {!loading && !error && ratings.length === 0 && (
            <p className="mr-status">You haven't rated any properties yet.</p>
          )}

          {!loading && ratings.length > 0 && (
            <>
              <table className="mr-table">
                <thead>
                  <tr>
                    <th>Property</th>
                    <th>Type</th>
                    <th>State</th>
                    <th>Rent/wk</th>
                    <th>Your Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {ratings.map((r, i) => {
                    const rental = rentals[r.rentalId];
                    return (
                      <tr
                        key={i}
                        className={selected?.id === r.rentalId ? 'mr-row-active' : ''}
                        onClick={() => rental && setSelected(
                          selected?.id === r.rentalId ? null : { ...rental, userRating: r.rating }
                        )}
                      >
                        <td>{rental?.title ?? '—'}</td>
                        <td>{rental?.propertyType ?? '—'}</td>
                        <td>{rental?.state ?? '—'}</td>
                        <td>{rental ? `$${rental.rent}` : '—'}</td>
                        <td className="mr-stars">{stars(r.rating)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Pagination */}
              <div className="mr-pagination">
                <button
                  className="mr-page-btn"
                  onClick={() => setPage(p => p - 1)}
                  disabled={page <= 1}
                >Prev</button>
                <span className="mr-page-indicator">{page} / {totalPages}</span>
                <button
                  className="mr-page-btn"
                  onClick={() => setPage(p => p + 1)}
                  disabled={page >= totalPages}
                >Next</button>
              </div>
            </>
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="mr-detail">
            <button className="mr-detail-close" onClick={() => setSelected(null)}>×</button>

            <div className="mr-detail-badge">{selected.propertyType}</div>
            <h2 className="mr-detail-title">{selected.title}</h2>
            <p className="mr-detail-address">
              {selected.streetAddress ? `${selected.streetAddress}, ` : ''}
              {selected.suburb}, {selected.state} {selected.postcode}
            </p>

            {selected.latitude && selected.longitude && (
              <div className="mr-detail-map">
                <Map
                  height={130}
                  defaultCenter={[selected.latitude, selected.longitude]}
                  defaultZoom={14}
                  attribution={false}
                >
                  <Marker width={32} anchor={[selected.latitude, selected.longitude]} color="#44dd44" />
                </Map>
              </div>
            )}

            <div className="mr-detail-price">
              <span className="mr-price-num">${selected.rent}</span>
              <span className="mr-price-label">/week</span>
            </div>

            <div className="mr-detail-stats">
              <div className="mr-stat"><span className="mr-stat-val">{selected.bedrooms}</span><span className="mr-stat-lbl">Bed</span></div>
              <div className="mr-stat"><span className="mr-stat-val">{selected.bathrooms}</span><span className="mr-stat-lbl">Bath</span></div>
              <div className="mr-stat"><span className="mr-stat-val">{selected.parkingSpaces}</span><span className="mr-stat-lbl">Parking</span></div>
            </div>

            <div className="mr-your-rating">
              <span className="mr-your-label">Your rating</span>
              <span className="mr-your-stars">{stars(selected.userRating)}</span>
            </div>

            {selected.description && (
              <p className="mr-detail-desc">
                {selected.description.replace(/<[^>]*>/g, ' ').trim()}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
