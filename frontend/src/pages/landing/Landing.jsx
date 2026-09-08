import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import LandingNavbar from './LandingNavbar';
import LandingFooter from './LandingFooter';

const Landing = () => {
    const navigate = useNavigate();

    // Check if user is already logged in, redirect to their dashboard if so
    useEffect(() => {
        const token = localStorage.getItem('access_token');
        if (token) {
            // Optional: You could decode the token and redirect automatically, 
            // but for a landing page, it's safer to let them click Login which handles the logic
        }
    }, []);

    return (
        <div className="bg-main text-main font-sans overflow-hidden">
            <LandingNavbar />

            {/* HERO SECTION */}
            <section className="landing-section bg-white position-relative overflow-hidden pt-5 pt-lg-0 d-flex align-items-center" style={{ minHeight: 'calc(100vh - 76px)' }}>
                {/* Background decorative blob */}
                <div className="position-absolute top-0 end-0 rounded-circle bg-primary opacity-10 blur-3xl animate-float-delayed" style={{ width: '800px', height: '800px', transform: 'translate(30%, -30%)', filter: 'blur(100px)' }}></div>
                
                <div className="container position-relative z-1" style={{ maxWidth: '1200px' }}>
                    <div className="row align-items-center gy-5">
                        
                        <div className="col-12 col-lg-6 text-center text-lg-start animate-fade-in-up">
                            <span className="badge bg-primary bg-opacity-10 text-primary px-3 py-2 rounded-pill fw-semibold text-uppercase tracking-wide mb-4 border border-primary border-opacity-25">
                                Smart Parcel Management
                            </span>
                            <h1 className="display-4 fw-bold text-dark mb-4 lh-sm" style={{ letterSpacing: '-0.03em' }}>
                                Secure every parcel from <span className="text-primary">gatehouse</span> to <span className="text-primary">verified handover.</span>
                            </h1>
                            <p className="lead text-muted mb-5 pe-lg-4" style={{ lineHeight: '1.6' }}>
                                GateVault helps residential communities register, track and securely hand over every delivery — without gatehouse congestion or uncertain parcel collection.
                            </p>
                            <div className="d-flex flex-column flex-sm-row justify-content-center justify-content-lg-start gap-3">
                                <Link to="/login" className="gv-btn-primary px-5 py-3 fs-5">
                                    Access GateVault
                                </Link>
                                <a href="#how-it-works" className="btn btn-outline-secondary px-5 py-3 fs-5 fw-medium">
                                    See How It Works
                                </a>
                            </div>
                        </div>

                        <div className="col-12 col-lg-6 position-relative animate-fade-in-up d-flex align-items-center justify-content-center mt-5 mt-lg-0" style={{ animationDelay: '0.2s' }}>
                            <div className="position-relative animate-float w-100" style={{ zIndex: 2, maxWidth: '420px' }}>
                                {/* Secondary Background Card */}
                                <div className="position-absolute bg-white rounded-4 shadow-sm border p-4 opacity-75" style={{ top: '-30px', right: '-10px', left: '30px', bottom: '30px', zIndex: -1, transform: 'rotate(6deg)' }}>
                                    <div className="d-flex align-items-center gap-2 mb-3 border-bottom pb-2">
                                        <i className="bi bi-bell-fill text-warning"></i>
                                        <span className="fw-bold small text-muted text-uppercase">Guard Notification</span>
                                    </div>
                                    <div className="d-flex align-items-center gap-3 mb-2">
                                        <div className="bg-primary bg-opacity-25 rounded-circle" style={{ width: '20px', height: '20px' }}></div>
                                        <div className="bg-light rounded w-50" style={{ height: '14px' }}></div>
                                    </div>
                                    <div className="bg-light rounded w-75 mb-2 ms-4" style={{ height: '10px' }}></div>
                                    <div className="bg-light rounded w-50 ms-4" style={{ height: '10px' }}></div>
                                </div>

                                {/* Mock UI representation */}
                                <div className="bg-white rounded-4 shadow-lg border p-4 position-relative mx-auto">
                                    <div className="d-flex justify-content-between align-items-center border-bottom pb-3 mb-3">
                                        <div className="fw-bold fs-5"><i className="bi bi-box-seam text-primary me-2"></i>GV-2026-001245</div>
                                        <span className="badge bg-warning text-dark px-3 py-2 rounded-pill">Awaiting Pickup</span>
                                    </div>
                                    <div className="row g-3 mb-4">
                                        <div className="col-6">
                                            <div className="text-muted small text-uppercase fw-bold mb-1">Destination</div>
                                            <div className="fw-medium">Resident, Flat A-304</div>
                                        </div>
                                        <div className="col-6">
                                            <div className="text-muted small text-uppercase fw-bold mb-1">Carrier</div>
                                            <div className="fw-medium">Amazon Delivery</div>
                                        </div>
                                    </div>
                                    <div className="bg-light rounded-3 p-3 text-center mb-3 border">
                                        <div className="text-muted small text-uppercase fw-bold mb-1">Secure PIN generated</div>
                                        <div className="display-4 fw-bold pin-display lh-1">5821</div>
                                    </div>
                                    
                                    {/* Floating success badge */}
                                    <div className="position-absolute bottom-0 start-0 translate-middle bg-success text-white rounded-pill px-4 py-3 shadow-lg d-flex align-items-center gap-2" style={{ transform: 'translate(-20%, 30%)!important', zIndex: 3 }}>
                                        <div className="bg-white text-success rounded-circle d-flex align-items-center justify-content-center" style={{ width: '24px', height: '24px' }}>
                                            <i className="bi bi-check-lg fw-bold"></i>
                                        </div>
                                        <span className="fw-bold">Verified Handover</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* TRUST STRIP */}
            <section className="bg-dark text-white py-4 border-top border-bottom border-secondary">
                <div className="container" style={{ maxWidth: '1200px' }}>
                    <div className="row g-3 text-center text-md-start">
                        <div className="col-12 col-sm-6 col-md-3 d-flex align-items-center justify-content-center justify-content-md-start gap-3">
                            <i className="bi bi-check-circle-fill text-info fs-4"></i>
                            <span className="fw-medium">Verified Handover</span>
                        </div>
                        <div className="col-12 col-sm-6 col-md-3 d-flex align-items-center justify-content-center justify-content-md-start gap-3">
                            <i className="bi bi-geo-alt-fill text-info fs-4"></i>
                            <span className="fw-medium">Real-Time Tracking</span>
                        </div>
                        <div className="col-12 col-sm-6 col-md-3 d-flex align-items-center justify-content-center justify-content-md-start gap-3">
                            <i className="bi bi-shield-lock-fill text-info fs-4"></i>
                            <span className="fw-medium">Secure Pickup PIN</span>
                        </div>
                        <div className="col-12 col-sm-6 col-md-3 d-flex align-items-center justify-content-center justify-content-md-start gap-3">
                            <i className="bi bi-bell-fill text-info fs-4"></i>
                            <span className="fw-medium">48-Hour Alerts</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* PROBLEM SECTION */}
            <section className="landing-section bg-main">
                <div className="container" style={{ maxWidth: '1200px' }}>
                    <div className="text-center mb-5 max-w-2xl mx-auto">
                        <h2 className="display-6 fw-bold text-dark mb-3">Parcel delivery shouldn't create gatehouse chaos.</h2>
                        <p className="lead text-muted">Without a digital system, modern communities struggle to securely process the massive daily influx of courier deliveries.</p>
                    </div>

                    <div className="row g-4 mt-4">
                        {[
                            { title: 'Gate Congestion', desc: 'Multiple deliveries can slow down entry and distract security staff.', icon: 'bi-cone-striped', color: 'danger' },
                            { title: 'Lost or Misplaced', desc: 'Manually recorded packages are difficult to track once they reach the gatehouse.', icon: 'bi-box-seam', color: 'warning' },
                            { title: 'Wrong Handover', desc: 'Without verification, parcels can be collected by the wrong person entirely.', icon: 'bi-person-x', color: 'danger' },
                            { title: 'Repeated Queries', desc: 'Residents often need to contact security just to know whether a parcel has arrived.', icon: 'bi-telephone', color: 'primary' },
                        ].map((item, i) => (
                            <div className="col-12 col-md-6 col-lg-3" key={i}>
                                <div className="gv-card p-4 h-100 hover-lift bg-white border-0">
                                    <div className={`bg-${item.color} bg-opacity-10 text-${item.color} d-inline-flex align-items-center justify-content-center rounded p-3 mb-4`}>
                                        <i className={`bi ${item.icon} fs-4`}></i>
                                    </div>
                                    <h5 className="fw-bold mb-3">{item.title}</h5>
                                    <p className="text-muted small">{item.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* SOLUTION (WORKFLOW) SECTION */}
            <section className="pt-5 pb-4 bg-white border-top">
                <div className="container text-center" style={{ maxWidth: '1200px' }}>
                    <h2 className="display-6 fw-bold text-dark mb-3">One secure workflow. Complete parcel visibility.</h2>
                    <p className="lead text-muted mb-5 mx-auto" style={{ maxWidth: '700px' }}>
                        GateVault creates a digital chain of custody from parcel arrival to verified resident handover.
                    </p>

                    {/* Desktop Horizontal Workflow */}
                    <div className="d-none d-lg-flex align-items-center justify-content-between position-relative mt-5 pt-4">
                        <div className="position-absolute top-50 start-0 w-100 border-top border-2 border-primary border-opacity-25" style={{ zIndex: 1, transform: 'translateY(-50%)' }}></div>
                        
                        {[
                            { step: '01', title: 'Parcel Arrives' },
                            { step: '02', title: 'Guard Registers' },
                            { step: '03', title: 'Resident Gets PIN' },
                            { step: '04', title: 'PIN Verified' },
                            { step: '05', title: 'Parcel Handed Over' },
                            { step: '06', title: 'History Recorded' },
                        ].map((s, i) => (
                            <div className="position-relative bg-white px-2 z-2 d-flex flex-column align-items-center" key={i} style={{ width: '150px' }}>
                                <div className="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center fw-bold shadow mb-3" style={{ width: '50px', height: '50px' }}>
                                    {s.step}
                                </div>
                                <h6 className="fw-bold mb-0 text-dark text-center">{s.title}</h6>
                            </div>
                        ))}
                    </div>

                    {/* Mobile Vertical Workflow */}
                    <div className="d-lg-none d-flex flex-column align-items-center gap-4 mt-5 position-relative pb-4">
                        <div className="position-absolute h-100 border-start border-2 border-primary border-opacity-25" style={{ left: '50%', transform: 'translateX(-50%)', zIndex: 1 }}></div>
                        {[
                            { step: '01', title: 'Parcel Arrives' },
                            { step: '02', title: 'Guard Registers' },
                            { step: '03', title: 'Resident Gets PIN' },
                            { step: '04', title: 'PIN Verified' },
                            { step: '05', title: 'Parcel Handed Over' },
                            { step: '06', title: 'History Recorded' },
                        ].map((s, i) => (
                            <div className="position-relative bg-white py-2 z-2 d-flex flex-column align-items-center" key={i}>
                                <div className="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center fw-bold shadow mb-2" style={{ width: '50px', height: '50px' }}>
                                    {s.step}
                                </div>
                                <h6 className="fw-bold mb-0 text-dark">{s.title}</h6>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* HOW IT WORKS (ROLES) */}
            <section id="how-it-works" className="pt-4 pb-5 bg-main border-top">
                <div className="container" style={{ maxWidth: '1200px' }}>
                    
                    <div className="row g-5">
                        <div className="col-12 col-md-4">
                            <div className="gv-card p-4 p-lg-5 h-100 hover-lift bg-white border-0 border-top border-4 border-primary">
                                <h3 className="fw-bold mb-3 d-flex align-items-center gap-3">
                                    <i className="bi bi-shield-check text-primary"></i> Security Guards
                                </h3>
                                <p className="text-muted mb-4">Register incoming deliveries in seconds, assign storage shelves and verify residents before handover.</p>
                                <ul className="list-unstyled mb-0 d-flex flex-column gap-3">
                                    <li className="d-flex align-items-center gap-2 fw-medium text-dark"><i className="bi bi-check2 text-success fs-5"></i> Fast parcel intake</li>
                                    <li className="d-flex align-items-center gap-2 fw-medium text-dark"><i className="bi bi-check2 text-success fs-5"></i> Pickup verification</li>
                                    <li className="d-flex align-items-center gap-2 fw-medium text-dark"><i className="bi bi-check2 text-success fs-5"></i> Gatehouse inventory</li>
                                    <li className="d-flex align-items-center gap-2 fw-medium text-dark"><i className="bi bi-check2 text-success fs-5"></i> Overdue parcel visibility</li>
                                </ul>
                            </div>
                        </div>

                        <div className="col-12 col-md-4">
                            <div className="gv-card p-4 p-lg-5 h-100 hover-lift bg-white border-0 border-top border-4 border-success">
                                <h3 className="fw-bold mb-3 d-flex align-items-center gap-3">
                                    <i className="bi bi-house-door text-success"></i> Residents
                                </h3>
                                <p className="text-muted mb-4">Know exactly when your parcel arrives and collect it securely using your personal pickup pass.</p>
                                <ul className="list-unstyled mb-0 d-flex flex-column gap-3">
                                    <li className="d-flex align-items-center gap-2 fw-medium text-dark"><i className="bi bi-check2 text-success fs-5"></i> Pending parcel dashboard</li>
                                    <li className="d-flex align-items-center gap-2 fw-medium text-dark"><i className="bi bi-check2 text-success fs-5"></i> Secure pickup PIN</li>
                                    <li className="d-flex align-items-center gap-2 fw-medium text-dark"><i className="bi bi-check2 text-success fs-5"></i> Real-time status</li>
                                    <li className="d-flex align-items-center gap-2 fw-medium text-dark"><i className="bi bi-check2 text-success fs-5"></i> Complete delivery history</li>
                                </ul>
                            </div>
                        </div>

                        <div className="col-12 col-md-4">
                            <div className="gv-card p-4 p-lg-5 h-100 hover-lift bg-white border-0 border-top border-4 border-info">
                                <h3 className="fw-bold mb-3 d-flex align-items-center gap-3">
                                    <i className="bi bi-person-workspace text-info"></i> Administrators
                                </h3>
                                <p className="text-muted mb-4">Monitor parcel operations across the community from one centralized dashboard.</p>
                                <ul className="list-unstyled mb-0 d-flex flex-column gap-3">
                                    <li className="d-flex align-items-center gap-2 fw-medium text-dark"><i className="bi bi-check2 text-success fs-5"></i> Parcel analytics</li>
                                    <li className="d-flex align-items-center gap-2 fw-medium text-dark"><i className="bi bi-check2 text-success fs-5"></i> Overdue monitoring</li>
                                    <li className="d-flex align-items-center gap-2 fw-medium text-dark"><i className="bi bi-check2 text-success fs-5"></i> Storage capacity</li>
                                    <li className="d-flex align-items-center gap-2 fw-medium text-dark"><i className="bi bi-check2 text-success fs-5"></i> Searchable history log</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                </div>
            </section>

            {/* FEATURES SECTION */}
            <section id="features" className="landing-section bg-white border-top">
                <div className="container" style={{ maxWidth: '1200px' }}>
                    <div className="text-center mb-5">
                        <h2 className="display-6 fw-bold text-dark mb-3">Built for secure, efficient communities.</h2>
                    </div>

                    <div className="row g-5 mt-3">
                        {[
                            { title: 'Fast Gatehouse Intake', desc: 'Register a delivery with tower, flat, carrier and storage information in seconds.', icon: 'bi-stopwatch' },
                            { title: 'Secure Pickup PIN', desc: 'Each parcel receives a unique pickup credential for verified collection.', icon: 'bi-qr-code' },
                            { title: 'Digital Chain of Custody', desc: 'Track who received and who handed over every parcel.', icon: 'bi-link-45deg' },
                            { title: '48-Hour Overstay Detection', desc: 'Identify parcels that remain uncollected for more than 48 hours.', icon: 'bi-clock-history' },
                            { title: 'Gatehouse Inventory', desc: 'Monitor shelf capacity and avoid storage overflow.', icon: 'bi-bookshelf' },
                            { title: 'Complete Delivery History', desc: 'Maintain a searchable record of parcel receipt and handover activity.', icon: 'bi-journal-check' },
                        ].map((f, i) => (
                            <div className="col-12 col-md-6 col-lg-4 d-flex align-items-start gap-4" key={i}>
                                <div className="bg-primary bg-opacity-10 text-primary rounded p-3 d-flex align-items-center justify-content-center" style={{ width: '60px', height: '60px', flexShrink: 0 }}>
                                    <i className={`bi ${f.icon} fs-3`}></i>
                                </div>
                                <div>
                                    <h5 className="fw-bold mb-2">{f.title}</h5>
                                    <p className="text-muted small lh-lg mb-0">{f.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* SECURITY SECTION */}
            <section id="security" className="landing-section bg-dark text-white position-relative overflow-hidden">
                <div className="container position-relative z-1" style={{ maxWidth: '1200px' }}>
                    <div className="row align-items-center gy-5">
                        <div className="col-12 col-lg-5 text-center text-lg-start">
                            <h2 className="display-5 fw-bold text-white mb-4">Security built into every handover.</h2>
                            <p className="lead text-white-50 mb-0">GateVault doesn't just track parcels. It verifies who collects them.</p>
                        </div>
                        <div className="col-12 col-lg-7 ps-lg-5">
                            <div className="row g-4">
                                <div className="col-12">
                                    <div className="d-flex align-items-start gap-4 p-4 rounded-4 bg-white bg-opacity-10 border border-secondary border-opacity-50 hover-lift">
                                        <i className="bi bi-person-badge fs-2 text-info"></i>
                                        <div>
                                            <h5 className="fw-bold mb-2">Authenticated Access</h5>
                                            <p className="text-white-50 small mb-0">Role-based access keeps resident, guard and administrative information separated.</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="col-12">
                                    <div className="d-flex align-items-start gap-4 p-4 rounded-4 bg-white bg-opacity-10 border border-secondary border-opacity-50 hover-lift">
                                        <i className="bi bi-shield-lock fs-2 text-info"></i>
                                        <div>
                                            <h5 className="fw-bold mb-2">Verified Pickup</h5>
                                            <p className="text-white-50 small mb-0">Pickup PIN verification helps ensure parcels are handed to the intended resident.</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="col-12">
                                    <div className="d-flex align-items-start gap-4 p-4 rounded-4 bg-white bg-opacity-10 border border-secondary border-opacity-50 hover-lift">
                                        <i className="bi bi-file-earmark-check fs-2 text-info"></i>
                                        <div>
                                            <h5 className="fw-bold mb-2">Audit Trail</h5>
                                            <p className="text-white-50 small mb-0">Every handover is recorded with timestamps and responsible personnel.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* DASHBOARD PREVIEW */}
            <section className="landing-section bg-main border-top">
                <div className="container" style={{ maxWidth: '1200px' }}>
                    <div className="text-center mb-5">
                        <h2 className="display-6 fw-bold text-dark mb-3">Everything the gatehouse needs. One place.</h2>
                    </div>

                    <div className="gv-card bg-white p-4 p-md-5 mx-auto shadow-lg" style={{ maxWidth: '900px' }}>
                        <div className="row g-4 mb-4">
                            {[
                                { t: 'Pending Parcels', v: '24', c: 'warning', icon: 'bi-clock' },
                                { t: 'Overdue', v: '3', c: 'danger', icon: 'bi-exclamation-triangle' },
                                { t: 'Handed Over Today', v: '18', c: 'success', icon: 'bi-check2-circle' },
                                { t: 'Storage', v: '72%', c: 'primary', icon: 'bi-pie-chart' }
                            ].map((stat, i) => (
                                <div className="col-6 col-md-3" key={i}>
                                    <div className="border rounded p-3">
                                        <div className={`text-${stat.c} mb-2`}><i className={stat.icon}></i></div>
                                        <h3 className="fw-bold mb-1">{stat.v}</h3>
                                        <div className="text-muted small text-uppercase fw-semibold" style={{ fontSize: '0.65rem' }}>{stat.t}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="border rounded overflow-hidden">
                            <div className="bg-light p-3 border-bottom text-muted small fw-bold text-uppercase d-none d-sm-flex justify-content-between">
                                <div style={{width: '25%'}}>ID</div>
                                <div style={{width: '25%'}}>Carrier</div>
                                <div style={{width: '25%'}}>Destination</div>
                                <div style={{width: '25%'}}>Status</div>
                            </div>
                            <div className="p-3 d-flex flex-column flex-sm-row justify-content-between align-items-sm-center border-bottom">
                                <div className="fw-bold" style={{width: '25%'}}>GV-2026-001245</div>
                                <div style={{width: '25%'}}>Amazon</div>
                                <div style={{width: '25%'}}>Flat A-304</div>
                                <div style={{width: '25%'}}><span className="badge bg-warning text-dark px-3 rounded-pill">Awaiting Pickup</span></div>
                            </div>
                            <div className="p-3 d-flex flex-column flex-sm-row justify-content-between align-items-sm-center">
                                <div className="fw-bold" style={{width: '25%'}}>GV-2026-001244</div>
                                <div style={{width: '25%'}}>Flipkart</div>
                                <div style={{width: '25%'}}>Flat B-102</div>
                                <div style={{width: '25%'}}><span className="badge bg-success px-3 rounded-pill">Handed Over</span></div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* BENEFITS SECTION */}
            <section id="benefits" className="landing-section bg-white border-top">
                <div className="container" style={{ maxWidth: '1200px' }}>
                    <div className="text-center mb-5">
                        <h2 className="display-6 fw-bold text-dark mb-3">Less manual work. More visibility. Better security.</h2>
                    </div>

                    <div className="row g-0 rounded-4 overflow-hidden shadow border mx-auto" style={{ maxWidth: '1000px' }}>
                        <div className="col-12 col-md-6 bg-light p-5 border-end">
                            <h4 className="fw-bold text-muted mb-4 d-flex align-items-center gap-2">
                                <i className="bi bi-x-circle text-danger"></i> Without GateVault
                            </h4>
                            <ul className="list-unstyled mb-0 d-flex flex-column gap-4">
                                {['Manual registers', 'Repeated resident calls', 'Unclear parcel status', 'Difficult tracking', 'Risk of wrong handover', 'Unknown storage capacity'].map((txt, i) => (
                                    <li className="d-flex align-items-start gap-3 text-muted" key={i}>
                                        <i className="bi bi-x text-danger fs-5 mt-n1"></i>
                                        <span className="fw-medium">{txt}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="col-12 col-md-6 bg-primary p-5 text-white">
                            <h4 className="fw-bold mb-4 d-flex align-items-center gap-2">
                                <i className="bi bi-check-circle text-info"></i> With GateVault
                            </h4>
                            <ul className="list-unstyled mb-0 d-flex flex-column gap-4">
                                {['Digital parcel records', 'Resident self-service', 'Real-time status', 'Complete history', 'Verified pickup', 'Storage visibility'].map((txt, i) => (
                                    <li className="d-flex align-items-start gap-3" key={i}>
                                        <i className="bi bi-check-lg text-info fs-5 mt-n1"></i>
                                        <span className="fw-medium">{txt}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            </section>

            {/* FINAL CTA */}
            <section className="landing-section bg-main border-top">
                <div className="container text-center" style={{ maxWidth: '800px' }}>
                    <h2 className="display-4 fw-bold text-dark mb-4">Make parcel handover smarter.</h2>
                    <p className="lead text-muted mb-5">
                        Give your security team the tools to manage deliveries efficiently while giving residents confidence that every parcel is accounted for.
                    </p>
                    <div className="d-flex flex-column flex-sm-row justify-content-center gap-3">
                        <Link to="/login" className="gv-btn-primary px-5 py-3 fs-5">
                            Access GateVault
                        </Link>
                        <a href="#how-it-works" className="btn btn-outline-secondary px-5 py-3 fs-5 fw-medium">
                            Explore How It Works
                        </a>
                    </div>
                </div>
            </section>

            <LandingFooter />
        </div>
    );
};

export default Landing;
