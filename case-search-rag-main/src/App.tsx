import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import ChatSearch from './pages/ChatSearch';
import FileManagement from './pages/FileManagement';

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<ChatSearch />} />
          <Route path="/files" element={<FileManagement />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
