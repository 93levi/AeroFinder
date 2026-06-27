import { BrowserRouter, Routes, Route } from 'react-router-dom'
import LandingPage    from './LandingPage.jsx'
import LoginPage      from './LoginPage.jsx'
import RegisterPage   from './RegisterPage.jsx'
import MyRatingsPage  from './MyRatingsPage.jsx'
import RentalPage     from './RentalPage.jsx'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"           element={<LandingPage />} />
        <Route path="/login"      element={<LoginPage />} />
        <Route path="/register"   element={<RegisterPage />} />
        <Route path="/my-ratings"    element={<MyRatingsPage />} />
        <Route path="/rentals/:id"   element={<RentalPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App