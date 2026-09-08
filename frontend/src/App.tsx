import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { ProtectedRoute } from './components/ProtectedRoute'
import { ToastViewport } from './components/ToastViewport'
import { useAuth } from './context/AuthContext'
import { AdminUsage } from './pages/AdminUsage'
import { Ask } from './pages/Ask'
import { Compare } from './pages/Compare'
import { DocumentDetail } from './pages/DocumentDetail'
import { Documents } from './pages/Documents'
import { EvalRunDetail } from './pages/EvalRunDetail'
import { Evaluation } from './pages/Evaluation'
import { Login } from './pages/Login'
import { NotFound } from './pages/NotFound'
import { QueryHistory } from './pages/QueryHistory'
import { Register } from './pages/Register'

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <AppShell>{children}</AppShell>
    </ProtectedRoute>
  )
}

export default function App() {
  const { isAuthenticated } = useAuth()

  return (
    <>
      <Routes>
        <Route path="/login" element={isAuthenticated ? <Navigate to="/documents" replace /> : <Login />} />
        <Route path="/register" element={isAuthenticated ? <Navigate to="/documents" replace /> : <Register />} />

        <Route path="/documents" element={<Shell><Documents /></Shell>} />
        <Route path="/documents/:id" element={<Shell><DocumentDetail /></Shell>} />
        <Route path="/ask" element={<Shell><Ask /></Shell>} />
        <Route path="/history" element={<Shell><QueryHistory /></Shell>} />
        <Route path="/compare" element={<Shell><Compare /></Shell>} />
        <Route path="/evaluation" element={<Shell><Evaluation /></Shell>} />
        <Route path="/evaluation/:id" element={<Shell><EvalRunDetail /></Shell>} />
        <Route path="/admin" element={<Shell><AdminUsage /></Shell>} />

        <Route path="/" element={<Navigate to="/documents" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <ToastViewport />
    </>
  )
}
