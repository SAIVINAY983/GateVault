import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const LandingNavbar = () => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const navLinks = [
        { name: 'How It Works', href: '#how-it-works' },
        { name: 'Features', href: '#features' },
        { name: 'Security', href: '#security' },
        { name: 'Benefits', href: '#benefits' },
    ];

    return (
        <nav className="navbar navbar-expand-lg bg-white border-bottom sticky-top py-3 shadow-sm">
            <div className="container" style={{ maxWidth: '1200px' }}>
                
                {/* Logo */}
                <Link to="/" className="navbar-brand d-flex align-items-center gap-2 text-primary fw-bold text-decoration-none">
                    <i className="bi bi-shield-check fs-3 text-info"></i>
                    <span className="fs-4 tracking-tight">GateVault</span>
                </Link>

                {/* Mobile Toggle */}
                <button 
                    className="navbar-toggler border-0 shadow-none" 
                    type="button" 
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                >
                    <i className={`bi ${isMenuOpen ? 'bi-x-lg' : 'bi-list'} fs-2`}></i>
                </button>

                {/* Nav Links */}
                <div className={`collapse navbar-collapse ${isMenuOpen ? 'show bg-white position-absolute top-100 start-0 w-100 px-4 pb-4 border-bottom shadow-sm' : ''}`} style={{ zIndex: 1050 }}>
                    <ul className="navbar-nav mx-auto mb-2 mb-lg-0 gap-lg-4 text-center text-lg-start mt-3 mt-lg-0">
                        {navLinks.map(link => (
                            <li className="nav-item" key={link.name}>
                                <a className="nav-link fw-medium text-dark px-0" href={link.href} onClick={() => setIsMenuOpen(false)}>
                                    {link.name}
                                </a>
                            </li>
                        ))}
                    </ul>
                    
                    {/* CTA */}
                    <div className="d-flex flex-column flex-lg-row align-items-lg-center gap-3 mt-3 mt-lg-0">
                        <Link to="/login" className="text-dark fw-medium text-decoration-none px-2">
                            Log In
                        </Link>
                        <Link to="/login" className="gv-btn-primary px-4 py-2">
                            Access GateVault
                        </Link>
                    </div>
                </div>
            </div>
        </nav>
    );
};

export default LandingNavbar;
