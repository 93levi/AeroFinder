import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import './SearchPage.css'

const API = '/api'

export default function SearchPage() {

  const [rentals, setRentals] = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    fetch(`${API}/rentals/search`, { cache: 'no-store' })
      .then(res => {
        if (!res.ok) throw new Error(`Server returned ${res.status}`)
        return res.json()
      })
      .then(data => {
        setRentals(data.data ?? [])
        setLoading(false)
      })
      .catch(err => {
        setError(err.message || 'Could not load rentals')
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="search-root">
        <div className="search-status">
          <div className="spinner" />
          <p>Fetching rentals from API…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="search-root">
        <div className="search-status error">
          <p>{error}</p>
          <Link to="/" className="back-link">Back to home</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="search-root">

      {/* Header */}
      <header className="search-header">
        <Link to="/" className="back-link">Back</Link>
        <div className="search-title-area">
          <h1>Rentals</h1>
          <span className="result-count">{rentals.length} properties found</span>
        </div>
      </header>

      {/* Results grid */}
      {rentals.length === 0 ? (
        <p className="search-empty">No rentals found.</p>
      ) : (
        <ul className="rental-grid">
          {rentals.map(rental => (
            <li key={rental.id} className="rental-card">
              <div className="rental-card-body">
                <h2 className="rental-title">{rental.title}</h2>
                <p className="rental-address">{rental.suburb}, {rental.state} {rental.postcode}</p>
                <p className="rental-meta">
                  {rental.bedrooms} bed &nbsp;·&nbsp; {rental.bathrooms} bath &nbsp;·&nbsp; {rental.parkingSpaces} parking
                </p>
              </div>
              <div className="rental-card-footer">
                <span className="rental-price">${rental.rent}<span className="per-week">/wk</span></span>
              </div>
            </li>
          ))}
        </ul>
      )}

    </div>
  )
}
