import React, { useState, useMemo } from 'react';
import { Prospect } from '../types';

interface ProspectsListViewProps {
    prospects: Prospect[];
    onSelectProspect: (prospectId: number) => void;
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

export const ProspectsListView: React.FC<ProspectsListViewProps> = ({ prospects, onSelectProspect }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<Prospect['status'] | 'All'>('All');
    const [sortBy, setSortBy] = useState<'lastContacted' | 'contact' | 'company'>('lastContacted');

    const filteredAndSortedProspects = useMemo(() => {
        let processedProspects = [...prospects];

        // 1. Filter by status
        if (statusFilter !== 'All') {
            processedProspects = processedProspects.filter(p => p.status === statusFilter);
        }

        // 2. Filter by search term
        if (searchTerm.trim()) {
            const lowercasedSearchTerm = searchTerm.toLowerCase();
            processedProspects = processedProspects.filter(p =>
                p.contact.toLowerCase().includes(lowercasedSearchTerm) ||
                p.company.toLowerCase().includes(lowercasedSearchTerm)
            );
        }

        // 3. Sort
        processedProspects.sort((a, b) => {
            switch (sortBy) {
                case 'contact':
                    return a.contact.localeCompare(b.contact);
                case 'company':
                    return a.company.localeCompare(b.company);
                case 'lastContacted':
                default:
                    const dateA = a.lastContacted ? new Date(a.lastContacted).getTime() : 0;
                    const dateB = b.lastContacted ? new Date(b.lastContacted).getTime() : 0;
                    return dateB - dateA; // Newest first
            }
        });
        
        return processedProspects;
    }, [prospects, statusFilter, searchTerm, sortBy]);


    return (
        <div>
            <h1 className="text-3xl font-bold text-white mb-2">Prospects</h1>
            <p className="text-gray-400 mb-6">Manage and contact your list of potential leads.</p>
            
            <div className="flex flex-wrap items-center gap-4 mb-4">
                <input
                    type="text"
                    placeholder="Search by name or company..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full sm:w-auto flex-grow max-w-sm bg-gray-800 text-white placeholder-gray-500 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 transition"
                />
                <div className="flex items-center gap-2">
                    <label htmlFor="status-filter" className="text-sm text-gray-400">Status:</label>
                    <select
                        id="status-filter"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as Prospect['status'] | 'All')}
                        className="bg-gray-800 text-white p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 transition appearance-none"
                    >
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
                    <select
                        id="sort-by"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as 'lastContacted' | 'contact' | 'company')}
                        className="bg-gray-800 text-white p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 transition appearance-none"
                    >
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
                                    <th key={header} scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                        {header}
                                    </th>
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
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <ProspectStatusBadge status={prospect.status} />
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{prospect.assignedTo}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                                        {prospect.lastContacted ? new Date(prospect.lastContacted).toLocaleDateString() : 'N/A'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};