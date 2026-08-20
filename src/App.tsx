import { Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import AddText from './routes/AddText'
import InkLab from './routes/InkLab'
import Library from './routes/Library'
import NotFound from './routes/NotFound'
import Progress from './routes/Progress'
import Review from './routes/Review'
import Settings from './routes/Settings'
import TextDetail from './routes/TextDetail'
import Today from './routes/Today'

export default function App() {
  return (
    <Routes>
      {/* The quiet room has no nav. */}
      <Route path="/review" element={<Review kind="review" />} />
      <Route path="/cold-check" element={<Review kind="cold" />} />

      <Route element={<AppShell />}>
        <Route path="/" element={<Today />} />
        <Route path="/library" element={<Library />} />
        <Route path="/text/:id" element={<TextDetail />} />
        <Route path="/add" element={<AddText />} />
        <Route path="/progress" element={<Progress />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/design" element={<InkLab />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
