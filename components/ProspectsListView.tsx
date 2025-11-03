import React, { useState, useMemo } from 'react';
import { Prospect } from '../types';
import { apiService } from '../services/apiService';
import { PlusIcon } from './Icons';

interface ProspectsListViewProps {
    prospects: Prospect[];
    onSelectProspect: (prospectId: number) => void;
    onDataRefresh: () => void;
}

const ProspectStatusBadge: React.FC<{ status: Prospect['status'] }> = ({ status }) => {
    const colors = {
        'Pending': 'bg-gray-600 text-gray-100',
        'Contacted': 'bg-blue-600 text-white',
        'Meeting Booked': 'bg-green-600 text-white',
        'Not Interested': 'bg-red-600 text-white',
        'Follow Up': 'bg-yellow-500 text-gray-900',
    };
    return <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${colors[status]}`}>{status}</span>;
};

const AddProspectModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onDataRefresh: () => void;
}> = ({ isOpen, onClose, onDataRefresh }) => {
    const [formData, setFormData] = useState({ contact: '', company: '', title: '', phone: '', email: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);
        try {
            await apiService.addProspect(formData);
            onDataRefresh();
            onClose();
            setFormData({ contact: '', company: '', title: '', phone: '', email: '' });
        } catch (err) {
            setError((err as Error).message || 'Failed to add prospect.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-lg">
                <h2 className="text-xl font-bold text-white mb-4">Add New Prospect</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <input type="text" name="contact" value={formData.contact} onChange={handleChange} placeholder="Contact Name" required className="bg-gray-900 p-2.5 rounded-lg" />
                        <input type="text" name="company" value={formData.company} onChange={handleChange} placeholder="Company" required className="bg-gray-900 p-2.5 rounded-lg" />
                        <input type="text" name="title" value={formData.title} onChange={handleChange} placeholder="Title" required className="bg-gray-900 p-2.5 rounded-lg" />
                        <input type="tel" name="phone" value={formData.phone} onChange={handleChange} placeholder="Phone Number" required className="bg-gray-900 p-2.5 rounded-lg" />
                    </div>
                    <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="Email Address" required className="bg-gray-900 p-2.5 rounded-lg w-full" />
                    {error && <p className="text-red-400 text-sm">{error}</p>}
                    <div className="mt-6 flex justify-end gap-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-700 transition">Cancel</button>
                        <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-teal-600 text-white font-semibold rounded-lg hover:bg-teal-700 transition disabled:opacity-50">{isSubmitting ? 'Saving...' : 'Save Prospect'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export const ProspectsListView: React.FC<ProspectsListViewProps> = ({ prospects, onSelectProspect, onDataRefresh }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<Prospect['status'] | 'All'>('All');
    const [sortBy, setSortBy] = useState<'lastContacted' | 'contact' | 'company'>('lastContacted');
    const [isModalOpen, setIsModalOpen] = useState(false);

    const filteredAndSortedProspects = useMemo(() => {
        let processedProspects = [...prospects];

        if (statusFilter !== 'All') {
            processedProspects = processedProspects.filter(p => p.status === statusFilter);
        }

        if (searchTerm.trim()) {
            const lowercasedSearchTerm = searchTerm.toLowerCase();
            processedProspects = processedProspects.filter(p =>
                p.contact.toLowerCase().includes(lowercasedSearchTerm) ||
                p.company.toLowerCase().includes(lowercasedSearchTerm)
            );
        }

        processedProspects.sort((a, b) => {
            switch (sortBy) {
                case 'contact': return a.contact.localeCompare(b.contact);
                case 'company': return a.company.localeCompare(b.company);
                case 'lastContacted':
                default:
                    const dateA = a.lastContacted ? new Date(a.lastContacted).getTime() : 0;
                    const dateB = b.lastContacted ? new Date(b.lastContacted).getTime() : 0;
                    return dateB - dateA;
            }
        });
        
        return processedProspects;
    }, [prospects, statusFilter, searchTerm, sortBy]);


    return (
        <div>
            <AddProspectModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onDataRefresh={onDataRefresh} />
            <div className="flex justify-between items-start mb-2">
                <div>
                    <h1 className="text-3xl font-bold text-white">Prospects</h1>
                    <p className="text-gray-400 mt-1">Manage and contact your list of potential leads.</p>
                </div>
                <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white font-semibold rounded-lg hover:bg-teal-700 transition">
                    <PlusIcon /> New Prospect
                </button>
            </div>
            
            <div className="flex flex-wrap items-center gap-4 my-6">
                <input
                    type="text"
                    placeholder="Search by name or company..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full sm:w-auto flex-grow max-w-sm bg-gray-800 text-white placeholder-gray-500 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 transition"
                />
                <div className="flex items-center gap-2">
                    <label htmlFor="status-filter" className="text-sm text-gray-400">Status:</label>
                    <select id="status-filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as Prospect['status'] | 'All')} className="bg-gray-800 text-white p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 transition appearance-none">
                        <option value="All">All</option>
                        <option value="Pending">Pending</option>
                        <option value="Contacted">Contacted</option>
                        <option value="Meeting Booked">Meeting Booked</option>
                        <option value="Not Interested">Not Interested</option>
                        <option value="Follow Up">Follow Up</option>
                    </select>
                </div>
                 <div className="flex items-center gap-2">
                    <label htmlFor="sort-by" className="text-sm text-gray-400">Sort by:</label>
                    <select id="sort-by" value={sortBy} onChange={(e) => setSortBy(e.target.value as 'lastContacted' | 'contact' | 'company')} className="bg-gray-800 text-white p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 transition appearance-none">
                        <option value="lastContacted">Last Contacted</option>
                        <option value="contact">Contact Name</option>
                        <option value="company">Company Name</option>
                    </select>
                </div>
            </div>

            <div className="bg-gray-800/70 rounded-xl shadow-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-700">
                        <thead className="bg-gray-900/50">
                            <tr>
                                {['Contact', 'Company', 'Status', 'Assigned To', 'Last Contacted'].map(header => (
                                    <th key={header} scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">{header}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="bg-gray-800 divide-y divide-gray-700">
                            {filteredAndSortedProspects.map(prospect => (
                                <tr key={prospect.id} onClick={() => onSelectProspect(prospect.id)} className="hover:bg-gray-700/50 cursor-pointer transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-white">{prospect.contact}</div>
                                        <div className="text-sm text-gray-400">{prospect.title}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{prospect.company}</td>
                                    <td className="px-6 py-4 whitespace-nowrap"><ProspectStatusBadge status={prospect.status} /></td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{prospect.assignedTo}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">{prospect.lastContacted ? new Date(prospect.lastContacted).toLocaleDateString() : 'N/A'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};