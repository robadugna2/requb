'use client';

import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/components/layout/LanguageContext';
import {
  getAdmins,
  createAdmin,
  updateAdmin,
  suspendAdmin,
  reactivateAdmin,
  deleteAdmin,
  getGroups,
  assignAdminToGroup,
  removeAdminFromGroup,
  getAdminById
} from '@/lib/api';
import {
  Plus,
  Search,
  MoreVertical,
  Shield,
  ShieldAlert,
  ShieldCheck,
  UserX,
  UserCheck,
  Edit,
  Trash2,
  Lock
} from 'lucide-react';
import { format } from 'date-fns';

const toast = {
  success: (msg: string) => alert(msg),
  error: (msg: string) => alert(msg)
};

export default function AdminsPage() {
  const { t } = useLanguage();
  const [admins, setAdmins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<any>(null);
  const [groups, setGroups] = useState<any[]>([]);
  
  // Create Admin Form
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
  });

  // Assign Group Form
  const [assignData, setAssignData] = useState({
    groupId: '',
    canManageMembers: false,
    canManageDeposits: false,
    canTriggerLottery: false,
    canManageRules: false,
  });

  const fetchAdmins = async () => {
    try {
      setLoading(true);
      const data = await getAdmins();
      setAdmins(data);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to fetch admins');
    } finally {
      setLoading(false);
    }
  };

  const fetchGroups = async () => {
    try {
      const data = await getGroups();
      setGroups(data);
    } catch (error: any) {
      toast.error('Failed to fetch groups');
    }
  };

  useEffect(() => {
    fetchAdmins();
    fetchGroups();
  }, []);

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createAdmin(formData);
      toast.success('Admin created successfully');
      setIsCreateModalOpen(false);
      setFormData({ name: '', email: '', password: '', phone: '' });
      fetchAdmins();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create admin');
    }
  };

  const handleToggleStatus = async (admin: any) => {
    try {
      if (admin.status === 'ACTIVE') {
        await suspendAdmin(admin.id);
        toast.success('Admin suspended');
      } else {
        await reactivateAdmin(admin.id);
        toast.success('Admin reactivated');
      }
      fetchAdmins();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update status');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to permanently delete this admin?')) {
      try {
        await deleteAdmin(id);
        toast.success('Admin deleted');
        fetchAdmins();
      } catch (error: any) {
        toast.error(error.response?.data?.message || 'Failed to delete admin');
      }
    }
  };

  const openAssignModal = async (admin: any) => {
    setSelectedAdmin(admin);
    setIsAssignModalOpen(true);
    try {
       const fullAdmin = await getAdminById(admin.id);
       setSelectedAdmin(fullAdmin); // Now has groupLeadership populated
    } catch (e) {
       toast.error("Failed to load admin details");
    }
  };

  const handleAssignGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAdmin) return;
    try {
      await assignAdminToGroup(selectedAdmin.id, assignData);
      toast.success('Group assigned successfully');
      setAssignData({
        groupId: '',
        canManageMembers: false,
        canManageDeposits: false,
        canTriggerLottery: false,
        canManageRules: false,
      });
      // Refresh admin details
      const fullAdmin = await getAdminById(selectedAdmin.id);
      setSelectedAdmin(fullAdmin);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to assign group');
    }
  };

  const handleRemoveGroup = async (groupId: string) => {
    if (!selectedAdmin) return;
    try {
      await removeAdminFromGroup(selectedAdmin.id, groupId);
      toast.success('Group removed');
      const fullAdmin = await getAdminById(selectedAdmin.id);
      setSelectedAdmin(fullAdmin);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to remove group');
    }
  };

  const filteredAdmins = admins.filter(admin => 
    admin.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    admin.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN': return <ShieldCheck className="h-4 w-4 text-primary-500" />;
      case 'ADMIN': return <Shield className="h-4 w-4 text-blue-500" />;
      case 'SUB_ADMIN': return <ShieldAlert className="h-4 w-4 text-orange-500" />;
      default: return <Shield className="h-4 w-4" />;
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN': return 'bg-primary-500/10 text-primary-500 border-primary-500/20';
      case 'ADMIN': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'SUB_ADMIN': return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      default: return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Admin Management</h1>
          <p className="text-sm text-gray-400">Manage platform administrators and sub-admins</p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Admin
        </button>
      </div>

      <div className="flex items-center gap-4 bg-gray-900 p-4 rounded-xl border border-gray-800">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search admins by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field pl-10"
          />
        </div>
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-800/50 border-b border-gray-800 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                <th className="p-4">Name & Contact</th>
                <th className="p-4">Role</th>
                <th className="p-4">Status</th>
                <th className="p-4">Created By</th>
                <th className="p-4">Groups</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-400">Loading admins...</td>
                </tr>
              ) : filteredAdmins.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-400">No admins found</td>
                </tr>
              ) : (
                filteredAdmins.map((admin) => (
                  <tr key={admin.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center font-bold text-gray-300">
                          {admin.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-white">{admin.name}</p>
                          <p className="text-xs text-gray-400">{admin.email}</p>
                          {admin.phone && <p className="text-xs text-gray-500">{admin.phone}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getRoleBadgeColor(admin.role)}`}>
                        {getRoleIcon(admin.role)}
                        {admin.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        admin.status === 'ACTIVE' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                      }`}>
                        {admin.status}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="text-sm text-gray-300">
                        {admin.createdBy ? admin.createdBy.name : 'System'}
                      </div>
                      <div className="text-xs text-gray-500">
                        {format(new Date(admin.createdAt), 'MMM d, yyyy')}
                      </div>
                    </td>
                    <td className="p-4 text-sm text-gray-300">
                      {admin.role === 'SUB_ADMIN' ? (
                         <button 
                            onClick={() => openAssignModal(admin)}
                            className="text-primary-400 hover:text-primary-300 underline underline-offset-2"
                         >
                            {admin._count?.groupLeadership || 0} assigned
                         </button>
                      ) : (
                        <span className="text-gray-500">All (Owned)</span>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-2">
                        {admin.role === 'SUB_ADMIN' && (
                          <button
                            onClick={() => openAssignModal(admin)}
                            className="p-2 text-gray-400 hover:text-white bg-gray-800 rounded-lg transition-colors"
                            title="Manage Groups"
                          >
                            <Shield className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleToggleStatus(admin)}
                          className={`p-2 rounded-lg transition-colors ${
                            admin.status === 'ACTIVE' 
                              ? 'text-orange-400 hover:text-orange-300 bg-orange-400/10 hover:bg-orange-400/20' 
                              : 'text-green-400 hover:text-green-300 bg-green-400/10 hover:bg-green-400/20'
                          }`}
                          title={admin.status === 'ACTIVE' ? 'Suspend Admin' : 'Reactivate Admin'}
                        >
                          {admin.status === 'ACTIVE' ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                        </button>
                        <button
                          onClick={() => handleDelete(admin.id)}
                          className="p-2 text-red-400 hover:text-red-300 bg-red-400/10 hover:bg-red-400/20 rounded-lg transition-colors"
                          title="Delete Admin"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Admin Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-md border border-gray-800 shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-6">Add New Admin</h2>
            <form onSubmit={handleCreateAdmin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input-field"
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="input-field"
                  placeholder="john@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Phone Number (Optional)</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="input-field"
                  placeholder="+251 911 234 567"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="input-field"
                  placeholder="••••••••"
                />
              </div>
              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="flex-1 px-4 py-2 bg-gray-800 text-white rounded-xl hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button type="submit" className="flex-1 btn-primary">
                  Create Admin
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Group Modal */}
      {isAssignModalOpen && selectedAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-2xl border border-gray-800 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-white mb-2">Manage Group Access</h2>
            <p className="text-sm text-gray-400 mb-6">
              Assign <strong className="text-white">{selectedAdmin.name}</strong> to manage specific groups
            </p>

            <div className="space-y-6">
              {/* Existing Assignments */}
              <div>
                <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">Current Assignments</h3>
                {selectedAdmin.groupLeadership?.length === 0 ? (
                  <div className="p-4 bg-gray-800/50 rounded-lg text-sm text-gray-400 border border-gray-800">
                    No groups assigned yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedAdmin.groupLeadership?.map((assignment: any) => (
                      <div key={assignment.group.id} className="p-4 bg-gray-800 rounded-xl border border-gray-700 flex justify-between items-center">
                        <div>
                          <div className="font-medium text-white">{assignment.group.name}</div>
                          <div className="flex gap-2 mt-2">
                            {assignment.canManageMembers && <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded">Members</span>}
                            {assignment.canManageDeposits && <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">Deposits</span>}
                            {assignment.canTriggerLottery && <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-1 rounded">Lottery</span>}
                            {assignment.canManageRules && <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-1 rounded">Rules</span>}
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveGroup(assignment.group.id)}
                          className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Assign New Group Form */}
              <div className="border-t border-gray-800 pt-6">
                <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">Assign New Group</h3>
                <form onSubmit={handleAssignGroup} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Select Group</label>
                    <select
                      required
                      value={assignData.groupId}
                      onChange={(e) => setAssignData({ ...assignData, groupId: e.target.value })}
                      className="input-field"
                    >
                      <option value="">-- Choose a group --</option>
                      {groups.filter(g => !selectedAdmin.groupLeadership?.find((l: any) => l.group.id === g.id)).map(group => (
                        <option key={group.id} value={group.id}>{group.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <label className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-700">
                      <input
                        type="checkbox"
                        checked={assignData.canManageMembers}
                        onChange={(e) => setAssignData({ ...assignData, canManageMembers: e.target.checked })}
                        className="rounded border-gray-600 bg-gray-900 text-primary-500 focus:ring-primary-500"
                      />
                      <span className="text-sm text-white">Manage Members</span>
                    </label>
                    <label className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-700">
                      <input
                        type="checkbox"
                        checked={assignData.canManageDeposits}
                        onChange={(e) => setAssignData({ ...assignData, canManageDeposits: e.target.checked })}
                        className="rounded border-gray-600 bg-gray-900 text-primary-500 focus:ring-primary-500"
                      />
                      <span className="text-sm text-white">Manage Deposits</span>
                    </label>
                    <label className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-700">
                      <input
                        type="checkbox"
                        checked={assignData.canTriggerLottery}
                        onChange={(e) => setAssignData({ ...assignData, canTriggerLottery: e.target.checked })}
                        className="rounded border-gray-600 bg-gray-900 text-primary-500 focus:ring-primary-500"
                      />
                      <span className="text-sm text-white">Trigger Lottery</span>
                    </label>
                    <label className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-700">
                      <input
                        type="checkbox"
                        checked={assignData.canManageRules}
                        onChange={(e) => setAssignData({ ...assignData, canManageRules: e.target.checked })}
                        className="rounded border-gray-600 bg-gray-900 text-primary-500 focus:ring-primary-500"
                      />
                      <span className="text-sm text-white">Manage Rules</span>
                    </label>
                  </div>

                  <div className="pt-4 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setIsAssignModalOpen(false)}
                      className="flex-1 px-4 py-2 bg-gray-800 text-white rounded-xl hover:bg-gray-700 transition-colors"
                    >
                      Close
                    </button>
                    <button type="submit" className="flex-1 btn-primary" disabled={!assignData.groupId}>
                      Assign Access
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
