/*
 * App.jsx — Root component
 * Single-page workbench, no auth required.
 */
import { Routes, Route, Navigate } from 'react-router-dom';
import WorkbenchPage from './pages/WorkbenchPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<WorkbenchPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
