import React from 'react';
import { Link } from 'react-router-dom';

const LandingFooter = () => {
    return (
        <footer className="bg-dark text-white pt-5 pb-4">
            <div className="container" style={{ maxWidth: '1200px' }}>
                <div className="row gy-4 mb-5">
                    
                    {/* Brand */}
                    <div className="col-12 col-md-5 pe-md-5">
                        <div className="d-flex align-items-center gap-2 mb-3">
                            <i className="bi bi-shield-check fs-3 text-info"></i>
                            <span className="fs-4 fw-bold tracking-tight">GateVault</span>
                        </div>
                        <p className="text-white-50 small pe-lg-5" style={{ lineHeight: '1.7' }}>
                            Smart parcel verification for modern gated communities. 
                            We help security teams manage deliveries efficiently while giving residents confidence that every parcel is accounted for.
                        </p>
                    </div>

                    {/* Navigation */}
                    <div className="col-6 col-md-3">
                        <h6 className="fw-bold mb-4 text-uppercase tracking-wider" style={{ fontSize: '0.85rem' }}>Product</h6>
                        <ul className="list-unstyled d-flex flex-column gap-2 mb-0">
                            <li><a href="#how-it-works" className="text-white-50 text-decoration-none">How It Works</a></li>
                            <li><a href="#features" className="text-white-50 text-decoration-none">Features</a></li>
                            <li><a href="#security" className="text-white-50 text-decoration-none">Security</a></li>
                            <li><a href="#benefits" className="text-white-50 text-decoration-none">Benefits</a></li>
                        </ul>
                    </div>

                    {/* Action */}
                    <div className="col-6 col-md-4">
                        <h6 className="fw-bold mb-4 text-uppercase tracking-wider" style={{ fontSize: '0.85rem' }}>Access</h6>
                        <ul className="list-unstyled d-flex flex-column gap-2 mb-0">
                            <li>
                                <Link to="/login" className="text-info text-decoration-none fw-medium d-inline-flex align-items-center gap-2">
                                    Login to Dashboard
                                    <i className="bi bi-arrow-right"></i>
                                </Link>
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="border-top border-secondary pt-4 mt-4 d-flex flex-column flex-md-row justify-content-between align-items-center gap-3">
                    <div className="text-white-50 small text-center text-md-start">
                        © 2026 GateVault. Smart Community Parcel Management.
                    </div>
                    <div className="d-flex gap-3 text-white-50">
                        <i className="bi bi-twitter"></i>
                        <i className="bi bi-linkedin"></i>
                        <i className="bi bi-github"></i>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default LandingFooter;
