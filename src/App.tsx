import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ListingsProvider } from './context/ListingsContext'
import { CallProvider } from './context/CallContext'
import { Header } from './components/Header'
import { Footer } from './components/Footer'
import { CallOverlay } from './components/CallOverlay'
import { LandingPage } from './pages/LandingPage'
import { ProductPage, LegacyListingRedirect } from './pages/ProductPage'
import { CategoryPage } from './pages/CategoryPage'
import { RegisterPage } from './pages/RegisterPage'
import { LoginPage } from './pages/LoginPage'
import { CreateListingPage } from './pages/CreateListingPage'
import { ProfilePage } from './pages/ProfilePage'
import { EditProfilePage } from './pages/EditProfilePage'
import { SettingsPage } from './pages/SettingsPage'

export default function App() {
  return (
    <AuthProvider>
      <ListingsProvider>
        <CallProvider>
          <BrowserRouter>
            <div className="app-shell">
              <Header />
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/szemelyauto" element={<CategoryPage />} />
                <Route path="/szemelyauto/:make" element={<CategoryPage />} />
                <Route path="/szemelyauto/:make/:model" element={<CategoryPage />} />
                <Route path="/szemelyauto/:make/:model/:slug" element={<ProductPage />} />
                <Route path="/auto/:id" element={<LegacyListingRedirect />} />
                <Route path="/regisztracio" element={<RegisterPage />} />
                <Route path="/belepes" element={<LoginPage />} />
                <Route path="/hirdetes-feladas" element={<CreateListingPage />} />
                <Route path="/profil" element={<ProfilePage />} />
                <Route path="/profil/szerkesztes" element={<EditProfilePage />} />
                <Route path="/profil/beallitasok" element={<SettingsPage />} />
              </Routes>
              <Footer />
              <CallOverlay />
            </div>
          </BrowserRouter>
        </CallProvider>
      </ListingsProvider>
    </AuthProvider>
  )
}
