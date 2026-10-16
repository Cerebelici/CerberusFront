import { Routes, Route } from 'react-router-dom';
import { ROUTES } from './constants.ts';
import './App.css'
import SideNav from './components/SideNav/SideNav.tsx'
import Home from './components/Home/Home.tsx';
import Devices from './components/Devices/Devices.tsx';
import Vulnerabilities from './components/Vulnerabilities/Vulnerabilities.tsx';
import Services from './components/Services/Services.tsx';
import Scans from './components/Scans/Scans.tsx';

function App() {
  return (
    <div className='app-body'>
      < SideNav />
      <main className='app-content'>
        <Routes>
          <Route path={ROUTES.HOME} element={<Home/>}></Route>
          <Route path={ROUTES.DEVICES} element={<Devices/>}></Route>
          <Route path={ROUTES.SERVICES} element={<Services/>} ></Route>
          <Route path={ROUTES.VULNERABILITIES} element={<Vulnerabilities/>}></Route>
          <Route path={ROUTES.SCANS} element={<Scans/>}></Route>
        </Routes>
      </main>
    </div>
  )
}

export default App
