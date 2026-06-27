import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Map, Marker } from 'pigeon-maps';
import './RentalPage.css';

const API = import.meta.env.VITE_API_BASE || '/api';

export default function RentalPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [rental,          setRental]          = useState(null);
  const [loading,         setLoading]         = useState(true);
  const [error,           setError]           = useState(null);
  const [ratings,         setRatings]         = useState([]);
  const [userRating,      setUserRating]      = useState(0);
  const [ratingSubmitting,setRatingSubmitting]= useState(false);
  const [ratingSuccess,   setRatingSuccess]   = useState(false);
  const [ratingError,     setRatingError]     = useState(null);

  const isLoggedIn = !!localStorage.getItem('token');

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const token = localStorage.getItem('token');
        const [rentalRes, ratingsRes] = await Promise.all([
          fetch(`${API}/rentals/${id}`),
          token
            ? fetch(`${API}/ratings/rentals/${id}`, {
                headers: { 'Authorization': `Bearer ${token}` },
              })
            : Promise.resolve(null),
        ]);

        if (!rentalRes.ok) throw new Error('Rental not found');
        const data = await rentalRes.json();
        setRental({ ...data, id: Number(id) });

        if (ratingsRes && ratingsRes.ok) {
          setRatings((await ratingsRes.json()) ?? []);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  async function handleSubmitRating() {
    if (!userRating || ratingSubmitting) return;
    setRatingSubmitting(true);
    setRatingError(null);
    setRatingSuccess(false);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/ratings/rentals/${id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ rating: userRating }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Could not submit rating');
      setRatingSuccess(true);
      const r2 = await fetch(`${API}/ratings/rentals/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (r2.ok) setRatings((await r2.json()) ?? []);
    } catch (err) {
      setRatingError(err.message);
    } finally {
      setRatingSubmitting(false);
    }
  }

  const stars = n => '★'.repeat(n) + '☆'.repeat(5 - n);

  return (
    <div className="rp-root">

      <div className="rp-header">
        <button className="rp-back" onClick={() => navigate(-1)}>Back</button>
        {rental && <h1 className="rp-title">{rental.title}</h1>}
      </div>

      {loading && <p className="rp-status">Loading…</p>}
      {error   && <p className="rp-status rp-error">{error}</p>}

      {rental && !loading && (
        <div className="rp-body">

          {/* Top bar */}
          <div className="rp-topbar">
            <div className="rp-topbar-left">
              <p className="rp-address">
                {rental.streetAddress ? `${rental.streetAddress}, ` : ''}
                {rental.suburb}, {rental.state} {rental.postcode}
              </p>
              {rental.agencyName && <p className="rp-agency">{rental.agencyName}</p>}
              <div className="rp-price">
                <span className="rp-price-num">${rental.rent}</span>
                <span className="rp-price-label">/week</span>
              </div>
              {rental.propertyType && <span className="rp-badge">{rental.propertyType}</span>}
            </div>

            {rental.averageRating != null && (
              <div className="rp-avg-rating">
                <span className="rp-avg-stars">{stars(Math.round(rental.averageRating))}</span>
                <span className="rp-avg-num">{rental.averageRating.toFixed(1)}</span>
                <span className="rp-avg-count">({rental.numRatings} review{rental.numRatings !== 1 ? 's' : ''})</span>
              </div>
            )}
          </div>

          {/* Stats bar */}
          <div className="rp-stats">
            <div className="rp-stat">
              <span className="rp-stat-val">{rental.bedrooms}</span>
              <span className="rp-stat-lbl">Bed</span>
            </div>
            <div className="rp-stat">
              <span className="rp-stat-val">{rental.bathrooms}</span>
              <span className="rp-stat-lbl">Bath</span>
            </div>
            <div className="rp-stat">
              <span className="rp-stat-val">{rental.parkingSpaces}</span>
              <span className="rp-stat-lbl">Parking</span>
            </div>
          </div>

          {/* Columns */}
          <div className="rp-columns">
            <div className="rp-main">
              {rental.description && (
                <p className="rp-description">
                  {rental.description.replace(/<[^>]*>/g, ' ').trim()}
                </p>
              )}

              <div className="rp-ratings-section">
                <div className="rp-divider" />
                {isLoggedIn ? (
                  <>
                    {!ratingSuccess ? (
                      <>
                        <p className="rp-ratings-label">Rate this property</p>
                        <div className="rp-star-row">
                          {[1,2,3,4,5].map(n => (
                            <button
                              key={n}
                              className={`rp-star-btn ${userRating >= n ? 'rp-star-active' : ''}`}
                              onClick={() => setUserRating(n)}
                            >
                              {userRating >= n ? '★' : '☆'}
                            </button>
                          ))}
                        </div>
                        {ratingError && <p className="rp-rating-error">{ratingError}</p>}
                        <button
                          className="rp-rating-submit"
                          onClick={handleSubmitRating}
                          disabled={!userRating || ratingSubmitting}
                        >
                          {ratingSubmitting ? 'Submitting…' : 'Submit Rating'}
                        </button>
                      </>
                    ) : (
                      <p className="rp-rating-success">Rating submitted</p>
                    )}
                    {ratings.length > 0 && (
                      <div className="rp-ratings-list">
                        {ratings.slice(0, 5).map((r, i) => (
                          <div key={i} className="rp-rating-row">
                            <span className="rp-rating-stars">{stars(r.rating)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="rp-login-prompt">
                    <Link to="/login" className="rp-login-link">Login</Link> to rate this property
                  </p>
                )}
              </div>
            </div>

            {rental.latitude && rental.longitude && (
              <div className="rp-map-col">
                <Map
                  height={380}
                  defaultCenter={[rental.latitude, rental.longitude]}
                  defaultZoom={14}
                  attribution={false}
                >
                  <Marker width={36} anchor={[rental.latitude, rental.longitude]} color="#44dd44" />
                </Map>
                <p className="rp-coords">{rental.latitude.toFixed(4)}, {rental.longitude.toFixed(4)}</p>
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
