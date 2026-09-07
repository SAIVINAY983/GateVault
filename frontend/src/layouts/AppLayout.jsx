import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/ui/Sidebar';
import Topbar from '../components/ui/Topbar';

const AppLayout = () => {
    const [isMobileOpen, setIsMobileOpen] = useState(false);

    return (
        <div className="d-flex vh-100 overflow-hidden bg-main">
            <Sidebar isMobileOpen={isMobileOpen} setIsMobileOpen={setIsMobileOpen} />
            
            <div className="d-flex flex-column flex-grow-1 overflow-hidden main-content-wrapper">
                <Topbar onMenuClick={() => setIsMobileOpen(true)} />
                
                <main className="flex-grow-1 overflow-auto p-3 p-md-4 hide-scrollbar" style={{ backgroundColor: 'var(--gv-bg-main)' }}>
                    <div className="container-fluid mx-auto" style={{ maxWidth: '1400px' }}>
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
};

export default AppLayout;
