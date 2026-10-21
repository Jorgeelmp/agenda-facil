import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import { ThemeProvider } from './context/ThemeContext'
import { PrivateRoute, PublicRoute } from './components/PrivateRoute'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Prestadores from './pages/Prestadores'
import MeuNegocio from './pages/MeuNegocio'
import PrestadorDetalhes from './pages/PrestadorDetalhes'
import GerenciarNegocio from './pages/GerenciarNegocio'
import Agendamentos from './pages/Agendamentos'
import Avaliacoes from './pages/Avaliacoes'
import Servicos from './pages/Servicos'
import Categorias from './pages/Categorias'
import AdminHome from './pages/AdminHome'
import InicioCliente from './pages/InicioCliente'
import InicioPrestador from './pages/InicioPrestador'
import Usuarios from './pages/Usuarios'
import MinhaConta from './pages/MinhaConta'

function Inicio() {
  const { payload } = useAuth()
  if (payload?.tipo === 'ADMIN') return <AdminHome />
  if (payload?.tipo === 'PRESTADOR') return <InicioPrestador />
  return <InicioCliente />
}

// Endereço antigo da gestão de serviços continua funcionando.
function RedirecionarServicos() {
  const { prestadorId } = useParams()
  return <Navigate to={`/dashboard/prestadores/${prestadorId}/gerenciar?aba=servicos`} replace />
}

export default function App() {
  return (
    <ThemeProvider>
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
            <Route path="/cadastro" element={<PublicRoute><Register /></PublicRoute>} />
            <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>}>
              <Route index element={<Inicio />} />
              <Route path="servicos" element={<Servicos />} />
              <Route path="prestadores" element={<Prestadores />} />
              <Route path="prestadores/:prestadorId" element={<PrestadorDetalhes />} />
              <Route path="prestadores/:prestadorId/gerenciar" element={<GerenciarNegocio />} />
              <Route path="prestadores/:prestadorId/servicos" element={<RedirecionarServicos />} />
              <Route path="meu-negocio" element={<MeuNegocio />} />
              <Route path="agendamentos" element={<Agendamentos />} />
              <Route path="avaliacoes" element={<Avaliacoes />} />
              <Route path="categorias" element={<Categorias />} />
              <Route path="usuarios" element={<Usuarios />} />
              <Route path="conta" element={<MinhaConta />} />
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
    </ThemeProvider>
  )
}
