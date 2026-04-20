import { Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Devices from './pages/Devices';
import Inbox from './pages/Inbox';
import Templates from './pages/Templates';
import Clients from './pages/Clients';
import Sidebar from './components/Sidebar';


function App() {
  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/devices" element={<Devices />} />
          <Route path="/inbox" element={<Inbox />} />
          <Route path="/templates" element={<Templates />} />
          <Route path="/clients" element={<Clients />} />
        </Routes>
      </main>
    </div>
  )
}


export default App
