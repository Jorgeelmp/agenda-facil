import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { PrivateRoute, PublicRoute } from './components/PrivateRoute'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Prestadores from './pages/Prestadores'
import MeuNegocio from './pages/MeuNegocio'
import PrestadorDetalhes from './pages/PrestadorDetalhes'
import Agendamentos from './pages/Agendamentos'
import Avaliacoes from './pages/Avaliacoes'
import Servicos from './pages/Servicos'
import Categorias from './pages/Categorias'
import GerenciarServicos from './pages/GerenciarServicos'
import AdminHome from './pages/AdminHome'
import Usuarios from './pages/Usuarios'
import { useAuth } from './context/AuthContext'

function Inicio() {
  const { payload } = useAuth()
  return payload?.tipo === 'ADMIN' ? <AdminHome /> : <Prestadores />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/cadastro" element={<PublicRoute><Register /></PublicRoute>} />
          <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>}>
            <Route index element={<Inicio />} />
            <Route path="prestadores" element={<Prestadores />} />
            <Route path="usuarios" element={<Usuarios />} />
            <Route path="meu-negocio" element={<MeuNegocio />} />
            <Route path="prestadores/:prestadorId" element={<PrestadorDetalhes />} />
            <Route path="agendamentos" element={<Agendamentos />} />
            <Route path="avaliacoes" element={<Avaliacoes />} />
            <Route path="servicos" element={<Servicos />} />
            <Route path="categorias" element={<Categorias />} />
            <Route path="prestadores/:prestadorId/servicos" element={<GerenciarServicos />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
