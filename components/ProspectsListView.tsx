import React, { useState } from 'react';
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

    const filteredProspects = prospects.filter(p => 
        p.contact.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.company.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div>
            <h1 className="text-3xl font-bold text-white mb-2">Prospects</h1>
            <p className="text-gray-400 mb-6">Manage and contact your list of potential leads.</p>
            
            <div className="mb-4">
                <input
                    type="text"
                    placeholder="Search by name or company..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full max-w-sm bg-gray-800 text-white placeholder-gray-500 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 transition"
                />
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
                            {filteredProspects.map(prospect => (
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
