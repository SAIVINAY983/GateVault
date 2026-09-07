import React, { useState, useEffect } from 'react';
import axiosInstance from '../../api/axiosInstance';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import DashboardCard from '../../components/ui/DashboardCard';
import { LoadingSpinner, ErrorState } from '../../components/ui/StateComponents';

const AdminDashboard = () => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchStats = async () => {
        try {
            setLoading(true);
            setError('');
            const res = await axiosInstance.get('admin/dashboard/');
            setStats(res.data);
        } catch (err) {
            setError('Failed to load analytics');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
    }, []);

    if (loading) return <LoadingSpinner message="Loading gatehouse analytics..." />;
    if (error) return <ErrorState message={error} onRetry={fetchStats} />;

    const storageData = [
        { name: 'Occupied', value: stats.storage.occupied },
        { name: 'Available', value: stats.storage.capacity - stats.storage.occupied }
    ];
    // Navy and Light Gray for pie chart
    const storageColors = ['#0f172a', '#e2e8f0'];

    const carrierData = stats.carrier_stats.map(c => ({
        name: c.carrier__name,
        parcels: c.count
    }));

    const occupancyRate = Math.round((stats.storage.occupied / stats.storage.capacity) * 100);

    return (
        <div className="container-fluid px-0">
            <div className="mb-4">
                <h2 className="fw-bold text-dark mb-1">Good morning, Admin</h2>
                <p className="text-muted">Gatehouse operations overview and real-time analytics.</p>
            </div>
            
            <div className="row g-4 mb-4">
                <div className="col-12 col-sm-6 col-xl-3">
                    <DashboardCard 
                        title="Total Parcels" 
                        value={stats.total_parcels} 
                        icon="bi-boxes" 
                        colorClass="text-primary" 
                    />
                </div>
                <div className="col-12 col-sm-6 col-xl-3">
                    <DashboardCard 
                        title="Pending Pickup" 
                        value={stats.pending_parcels} 
                        icon="bi-clock-history" 
                        colorClass="text-warning" 
                    />
                </div>
                <div className="col-12 col-sm-6 col-xl-3">
                    <DashboardCard 
                        title="Handed Over Today" 
                        value={stats.handed_over_today} 
                        icon="bi-check-circle-fill" 
                        colorClass="text-success" 
                    />
                </div>
                <div className="col-12 col-sm-6 col-xl-3">
                    <DashboardCard 
                        title="Overdue" 
                        value={stats.overdue_parcels} 
                        subtitle=">48 Hours"
                        icon="bi-exclamation-triangle-fill" 
                        colorClass="text-danger" 
                    />
                </div>
            </div>

            <div className="row g-4">
                <div className="col-12 col-lg-5">
                    <div className="gv-card h-100">
                        <div className="card-body p-4 d-flex flex-column">
                            <h5 className="fw-bold mb-1">Gatehouse Storage</h5>
                            <p className="text-muted small mb-4">Current physical space utilization</p>
                            
                            <div className="flex-grow-1 position-relative d-flex align-items-center justify-content-center" style={{ minHeight: '250px' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={storageData}
                                            innerRadius={70}
                                            outerRadius={100}
                                            paddingAngle={2}
                                            dataKey="value"
                                            stroke="none"
                                        >
                                            {storageData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={storageColors[index % storageColors.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip 
                                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                            itemStyle={{ color: '#0f172a', fontWeight: '600' }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="position-absolute top-50 start-50 translate-middle text-center">
                                    <div className="display-5 fw-bold text-dark lh-1">{occupancyRate}%</div>
                                    <small className="text-muted text-uppercase fw-semibold" style={{ fontSize: '0.65rem', letterSpacing: '0.05em' }}>Occupied</small>
                                </div>
                            </div>
                            
                            <div className="d-flex justify-content-between align-items-center mt-3 pt-3 border-top">
                                <div>
                                    <div className="d-flex align-items-center gap-2 mb-1">
                                        <div className="rounded-circle bg-primary" style={{ width: '10px', height: '10px' }}></div>
                                        <small className="text-muted fw-medium">Occupied</small>
                                    </div>
                                    <div className="fw-bold fs-5 ps-3">{stats.storage.occupied}</div>
                                </div>
                                <div className="text-end">
                                    <div className="d-flex align-items-center gap-2 mb-1 justify-content-end">
                                        <div className="rounded-circle bg-light border" style={{ width: '10px', height: '10px' }}></div>
                                        <small className="text-muted fw-medium">Available</small>
                                    </div>
                                    <div className="fw-bold fs-5 pe-1">{stats.storage.capacity - stats.storage.occupied}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div className="col-12 col-lg-7">
                    <div className="gv-card h-100">
                        <div className="card-body p-4 d-flex flex-column">
                            <h5 className="fw-bold mb-1">Carrier Distribution</h5>
                            <p className="text-muted small mb-4">Volume of parcels delivered by carrier</p>
                            
                            <div className="flex-grow-1 w-100" style={{ minHeight: '300px' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={carrierData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                                        <Tooltip 
                                            cursor={{ fill: '#f1f5f9' }}
                                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        />
                                        <Bar dataKey="parcels" fill="#3b82f6" radius={[4, 4, 4, 4]} barSize={40} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
