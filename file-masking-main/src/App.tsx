import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import Layout from './components/Layout';
import WordsSettingsPage from './pages/WordsSettingsPage';
import CheckPage from './pages/CheckPage';
import ResultsPage from './pages/ResultsPage';

function App() {
  return (
    <AppProvider>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<Navigate to="/check" replace />} />
            <Route path="/settings/words" element={<WordsSettingsPage />} />
            {/* 旧URL互換性のためリダイレクト */}
            <Route path="/settings/ng-words" element={<Navigate to="/settings/words" replace />} />
            <Route path="/check" element={<CheckPage />} />
            <Route path="/check/results" element={<ResultsPage />} />
          </Routes>
        </Layout>
      </Router>
    </AppProvider>
  );
}

export default App;
