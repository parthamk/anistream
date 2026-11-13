
import {
  Routes,
  Route,
  Outlet
} from 'react-router-dom'

import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'

import Navbar from './components/Navbar'
import Footer from './components/Footer'
import Toast from './components/Toast'

import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'

import Home from './pages/Home'
import Search from './pages/Search'
import AnimeDetail from './pages/AnimeDetail'
import Watch from './pages/Watch'
import Library from './pages/Library'
import Login from './pages/Login'
import Signup from './pages/Signup'
import AdminSources from './pages/AdminSources'
import NotFound from './pages/NotFound'

function AppLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-dark-950">
      <Navbar />

      <div className="flex-1">
        <Outlet />
      </div>

      <Footer />

      <Toast />
    </div>
  )
}

function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route
          path="/"
          element={<Home />}
        />

        <Route
          path="/search"
          element={<Search />}
        />

        <Route
          path="/anime/:id"
          element={<AnimeDetail />}
        />

        <Route
          path="/watch/:animeId/:episode"
          element={<Watch />}
        />

        <Route
          path="/library"
          element={
            <ProtectedRoute>
              <Library />
            </ProtectedRoute>
          }
        />

        <Route
          path="/login"
          element={<Login />}
        />

        <Route
          path="/signup"
          element={<Signup />}
        />

        <Route
          path="/admin/sources"
          element={
            <AdminRoute>
              <AdminSources />
            </AdminRoute>
          }
        />

        <Route
          path="*"
          element={<NotFound />}
        />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppRoutes />
      </ToastProvider>
    </AuthProvider>
  )
}
