import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { Auth } from './pages/Auth'
import { Landing } from './pages/Landing'
import { Song } from './pages/Song'
import { Songs } from './pages/Songs'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/songs" element={<Songs />} />
        <Route path="/songs/:id" element={<Song />} />
        <Route path="/login" element={<Auth mode="login" />} />
        <Route path="/register" element={<Auth mode="register" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
