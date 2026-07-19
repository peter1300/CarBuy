import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ListingsProvider } from './context/ListingsContext'
import { CallProvider } from './context/CallContext'
import { MessagesProvider } from './context/MessagesContext'
import { FavoritesProvider } from './context/FavoritesContext'
import { LocaleProvider } from './i18n/LocaleContext'
import { Header } from './components/Header'
import { Footer } from './components/Footer'
import { CallOverlay } from './components/CallOverlay'
import { LandingPage } from './pages/LandingPage'
import { ProductPage, LegacyListingRedirect } from './pages/ProductPage'
import { CategoryPage } from './pages/CategoryPage'
import { ListingsPage } from './pages/ListingsPage'
import { RegisterPage } from './pages/RegisterPage'
import { LoginPage } from './pages/LoginPage'
import { CreateListingPage } from './pages/CreateListingPage'
import { ProfilePage } from './pages/ProfilePage'
import { EditProfilePage } from './pages/EditProfilePage'
import { SettingsPage } from './pages/SettingsPage'
import { MessagesInboxPage, MessagesChatPage } from './pages/MessagesPage'
import { ReelsPage } from './pages/ReelsPage'
import { FavoritesPage } from './pages/FavoritesPage'
import { AdminPage } from './pages/AdminPage'
import { NotFoundPage } from './pages/NotFoundPage'

export default function App() {
  return (
    <AuthProvider>
      <LocaleProvider>
        <ListingsProvider>
          <FavoritesProvider>
            <CallProvider>
              <MessagesProvider>
                <BrowserRouter>
                  <div className="app-shell">
                    <Header />
                    <Routes>
                      <Route path="/" element={<LandingPage />} />
                      <Route path="/reels" element={<ReelsPage />} />
                      <Route path="/kedvencek" element={<FavoritesPage />} />
                      <Route path="/hirdetesek" element={<ListingsPage />} />
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
                      <Route path="/uzenetek" element={<MessagesInboxPage />} />
                      <Route path="/uzenetek/:conversationId" element={<MessagesChatPage />} />
                      <Route path="/admin" element={<AdminPage />} />
                      <Route path="*" element={<NotFoundPage />} />
                    </Routes>
                    <Footer />
                    <CallOverlay />
                  </div>
                </BrowserRouter>
              </MessagesProvider>
            </CallProvider>
          </FavoritesProvider>
        </ListingsProvider>
      </LocaleProvider>
    </AuthProvider>
  )
}
