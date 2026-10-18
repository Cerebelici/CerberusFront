import { Routes, Route, useLocation } from 'react-router-dom';
import { ROUTES } from './constants.ts';
import './App.css'
import SideNav from './components/SideNav/SideNav.tsx'
import Home from './components/Home/Home.tsx';
import Devices from './components/Devices/Devices.tsx';
import Vulnerabilities from './components/Vulnerabilities/Vulnerabilities.tsx';
import Services from './components/Services/Services.tsx';
import { ScanPage } from './components/scan';

function App() {
  const { pathname } = useLocation();

  return (
    <div className='app-body'>
      < SideNav />
      <main className='app-content'>
        <div hidden={pathname !== ROUTES.HOME}>
          <Home />
        </div>
        <Routes>
          <Route path={ROUTES.DEVICES} element={<Devices/>}></Route>
          <Route path={ROUTES.SERVICES} element={<Services/>} ></Route>
          <Route path={ROUTES.VULNERABILITIES} element={<Vulnerabilities/>}></Route>
          <Route path={ROUTES.SCANS} element={<ScanPage/>}></Route>
        </Routes>
      </main>
    </div>
  )
}

export default App
