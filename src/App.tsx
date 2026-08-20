import { Navigate, Route, Routes } from 'react-router-dom'
import InkLab from './routes/InkLab'

export default function App() {
  return (
    <Routes>
      <Route path="/design" element={<InkLab />} />
      <Route path="*" element={<Navigate to="/design" replace />} />
    </Routes>
  )
}
