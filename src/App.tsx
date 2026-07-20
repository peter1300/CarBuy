import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ListingsProvider } from './context/ListingsContext'
import { CallProvider } from './context/CallContext'
import { MessagesProvider } from './context/MessagesContext'
import { FavoritesProvider } from './context/FavoritesContext'
import { LocaleProvider } from './i18n/LocaleContext'
import { Header } from './components/Header'
import { MobileBottomNav } from './components/MobileBottomNav'
import { Footer } from './components/Footer'
import { CallOverlay } from './components/CallOverlay'
import { PageLoader } from './components/PageLoader'

const LandingPage = lazy(() =>
  import('./pages/LandingPage').then((m) => ({ default: m.LandingPage })),
)
const ProductPage = lazy(() =>
  import('./pages/ProductPage').then((m) => ({ default: m.ProductPage })),
)
const LegacyListingRedirect = lazy(() =>
  import('./pages/ProductPage').then((m) => ({ default: m.LegacyListingRedirect })),
)
const CategoryPage = lazy(() =>
  import('./pages/CategoryPage').then((m) => ({ default: m.CategoryPage })),
)
const ListingsPage = lazy(() =>
  import('./pages/ListingsPage').then((m) => ({ default: m.ListingsPage })),
)
const RegisterPage = lazy(() =>
  import('./pages/RegisterPage').then((m) => ({ default: m.RegisterPage })),
)
const LoginPage = lazy(() => import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })))
const CreateListingPage = lazy(() =>
  import('./pages/CreateListingPage').then((m) => ({ default: m.CreateListingPage })),
)
const EditListingPage = lazy(() =>
  import('./pages/EditListingPage').then((m) => ({ default: m.EditListingPage })),
)
const ProfilePage = lazy(() =>
  import('./pages/ProfilePage').then((m) => ({ default: m.ProfilePage })),
)
const EditProfilePage = lazy(() =>
  import('./pages/EditProfilePage').then((m) => ({ default: m.EditProfilePage })),
)
const SettingsPage = lazy(() =>
  import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })),
)
const MessagesInboxPage = lazy(() =>
  import('./pages/MessagesPage').then((m) => ({ default: m.MessagesInboxPage })),
)
const MessagesChatPage = lazy(() =>
  import('./pages/MessagesPage').then((m) => ({ default: m.MessagesChatPage })),
)
const ReelsPage = lazy(() => import('./pages/ReelsPage').then((m) => ({ default: m.ReelsPage })))
const FavoritesPage = lazy(() =>
  import('./pages/FavoritesPage').then((m) => ({ default: m.FavoritesPage })),
)
const AdminPage = lazy(() => import('./pages/AdminPage').then((m) => ({ default: m.AdminPage })))
const NotFoundPage = lazy(() =>
  import('./pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })),
)

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
                    <Suspense fallback={<PageLoader />}>
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
                        <Route path="/profil/hirdetes/:id/szerkesztes" element={<EditListingPage />} />
                        <Route path="/profil/szerkesztes" element={<EditProfilePage />} />
                        <Route path="/profil/beallitasok" element={<SettingsPage />} />
                        <Route path="/uzenetek" element={<MessagesInboxPage />} />
                        <Route path="/uzenetek/:conversationId" element={<MessagesChatPage />} />
                        <Route path="/admin" element={<AdminPage />} />
                        <Route path="*" element={<NotFoundPage />} />
                      </Routes>
                    </Suspense>
                    <Footer />
                    <MobileBottomNav />
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
