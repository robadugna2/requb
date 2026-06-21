'use client';

import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/components/layout/LanguageContext';
import { useRouter } from 'next/navigation';
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
  getAdminById,
  getPasswordResetRequests,
  approvePasswordReset,
  rejectPasswordReset,
  type PasswordResetRequest,
} from '@/lib/api';
import {
  Plus,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  UserX,
  UserCheck,
  Trash2,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Clock,
  XCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import Modal from '@/components/ui/Modal';
import { useAdminPermissions } from '@/lib/useAdminPermissions';

export default function AdminsPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const permissions = useAdminPermissions();
  const canManageAdmins = permissions.isFullAccess;
  const [admins, setAdmins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Custom Alert / Confirm popup state
  const [alertPopup, setAlertPopup] = useState<{ isOpen: boolean; title: string; message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [confirmPopup, setConfirmPopup] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void } | null>(null);

  // Password Reset Requests state
  const [resetRequests, setResetRequests] = useState<PasswordResetRequest[]>([]);
  const [resetRequestsLoading, setResetRequestsLoading] = useState(false);
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [selectedResetRequest, setSelectedResetRequest] = useState<PasswordResetRequest | null>(null);
  const [tempPassword, setTempPassword] = useState('');
  const [rejectionNote, setRejectionNote] = useState('');
  const [resetActionLoading, setResetActionLoading] = useState(false);

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

  const showAlert = (title: string, message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setAlertPopup({ isOpen: true, title, message, type });
  };

  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmPopup({ isOpen: true, title, message, onConfirm });
  };

  const toast = {
    success: (msg: string) => showAlert('Success', msg, 'success'),
    error: (msg: string) => showAlert('Error', msg, 'error')
  };

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

  const fetchResetRequests = async () => {
    try {
      setResetRequestsLoading(true);
      const data = await getPasswordResetRequests();
      setResetRequests(data);
    } catch {
      // silently fail — user might not have permission if not ADMIN/SUPER_ADMIN
    } finally {
      setResetRequestsLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
    fetchGroups();
    fetchResetRequests();
  }, []);

  const handleApproveReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedResetRequest) return;
    setResetActionLoading(true);
    try {
      await approvePasswordReset(selectedResetRequest.id, tempPassword);
      toast.success(`Password reset approved for ${selectedResetRequest.requester.name}. Inform them of the temporary password.`);
      setIsApproveModalOpen(false);
      setTempPassword('');
      fetchResetRequests();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to approve reset');
    } finally {
      setResetActionLoading(false);
    }
  };

  const handleRejectReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedResetRequest) return;
    setResetActionLoading(true);
    try {
      await rejectPasswordReset(selectedResetRequest.id, rejectionNote || undefined);
      toast.success(`Reset request from ${selectedResetRequest.requester.name} rejected.`);
      setIsRejectModalOpen(false);
      setRejectionNote('');
      fetchResetRequests();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to reject reset');
    } finally {
      setResetActionLoading(false);
    }
  };

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
    showConfirm('Delete Admin', 'Are you sure you want to permanently delete this admin?', async () => {
      try {
        await deleteAdmin(id);
        toast.success('Admin deleted');
        fetchAdmins();
      } catch (error: any) {
        toast.error(error.response?.data?.message || 'Failed to delete admin');
      }
    });
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
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
              title="Back"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Admin Management</h1>
              <p className="text-sm text-gray-500">Manage platform administrators and sub-admins</p>
            </div>
          </div>
          {canManageAdmins && (
            <Button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Admin
            </Button>
          )}
        </div>

        {/* Password Reset Requests Inbox */}
        {canManageAdmins && (resetRequests.length > 0 || resetRequestsLoading) && (
          <div className="bg-white rounded-xl border border-amber-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 bg-amber-50 border-b border-amber-100">
              <div className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-amber-600" />
                <h2 className="font-semibold text-amber-900">Password Reset Requests</h2>
                {resetRequests.filter(r => r.status === 'PENDING').length > 0 && (
                  <span className="ml-1 px-2 py-0.5 text-xs font-bold bg-amber-500 text-white rounded-full">
                    {resetRequests.filter(r => r.status === 'PENDING').length}
                  </span>
                )}
              </div>
              <button
                onClick={fetchResetRequests}
                className="text-xs text-amber-700 hover:text-amber-900 font-medium"
              >Refresh</button>
            </div>
            <div className="divide-y divide-gray-100">
              {resetRequestsLoading ? (
                <div className="p-6 text-center text-gray-400 text-sm">Loading requests...</div>
              ) : resetRequests.length === 0 ? (
                <div className="p-6 text-center text-gray-400 text-sm">No reset requests</div>
              ) : (
                resetRequests.map((req) => (
                  <div key={req.id} className="flex items-center justify-between px-5 py-4 hover:bg-gray-50/50">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center font-bold text-amber-700 text-sm flex-shrink-0">
                        {req.requester.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{req.requester.name}</p>
                        <p className="text-xs text-gray-500">{req.requester.email} · {req.requester.role.replace('_', ' ')}</p>
                        <p className="text-xs text-gray-400">{new Date(req.createdAt).toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {req.status === 'PENDING' ? (
                        <>
                          <span className="flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-full">
                            <Clock className="h-3 w-3" /> Pending
                          </span>
                          <button
                            onClick={() => { setSelectedResetRequest(req); setTempPassword(''); setIsApproveModalOpen(true); }}
                            className="px-3 py-1.5 text-xs font-semibold bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                          >Approve</button>
                          <button
                            onClick={() => { setSelectedResetRequest(req); setRejectionNote(''); setIsRejectModalOpen(true); }}
                            className="px-3 py-1.5 text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg transition-colors"
                          >Reject</button>
                        </>
                      ) : req.status === 'APPROVED' ? (
                        <span className="flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded-full">
                          <CheckCircle2 className="h-3 w-3" /> Approved
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 px-2 py-1 rounded-full">
                          <XCircle className="h-3 w-3" /> Rejected
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Search */}
        <div className="flex items-center gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
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

        {/* Admins Table Card */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="p-4">Name & Contact</th>
                  <th className="p-4">Role</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Created By</th>
                  <th className="p-4">Groups</th>
                  {canManageAdmins && <th className="p-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={canManageAdmins ? 6 : 5} className="p-8 text-center text-gray-400">Loading admins...</td>
                  </tr>
                ) : filteredAdmins.length === 0 ? (
                  <tr>
                    <td colSpan={canManageAdmins ? 6 : 5} className="p-8 text-center text-gray-400">No admins found</td>
                  </tr>
                ) : (
                  filteredAdmins.map((admin) => (
                    <tr key={admin.id} className="hover:bg-gray-50/30 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-700">
                            {admin.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{admin.name}</p>
                            <p className="text-xs text-gray-500">{admin.email}</p>
                            {admin.phone && <p className="text-xs text-gray-400">{admin.phone}</p>}
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
                          admin.status === 'ACTIVE' ? 'bg-green-500/10 text-green-700' : 'bg-red-500/10 text-red-700'
                        }`}>
                          {admin.status}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="text-sm text-gray-700">
                          {admin.createdBy ? admin.createdBy.name : 'System'}
                        </div>
                        <div className="text-xs text-gray-400">
                          {format(new Date(admin.createdAt), 'MMM d, yyyy')}
                        </div>
                      </td>
                      <td className="p-4 text-sm text-gray-700">
                        {admin.role === 'SUB_ADMIN' ? (
                          canManageAdmins ? (
                            <button 
                              onClick={() => openAssignModal(admin)}
                              className="text-primary-600 hover:text-primary-700 font-medium underline underline-offset-2"
                            >
                              {admin._count?.groupLeadership || 0} assigned
                            </button>
                          ) : (
                            <span className="text-gray-600">{admin._count?.groupLeadership || 0} assigned</span>
                          )
                        ) : (
                          <span className="text-gray-400">All (Owned)</span>
                        )}
                      </td>
                      {canManageAdmins && (
                        <td className="p-4">
                          <div className="flex items-center justify-end gap-2">
                            {admin.role === 'SUB_ADMIN' && (
                              <button
                                onClick={() => openAssignModal(admin)}
                                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors"
                                title="Manage Groups"
                              >
                                <Shield className="h-4 w-4" />
                              </button>
                            )}
                            <button
                              onClick={() => handleToggleStatus(admin)}
                              className={`p-2 rounded-lg border transition-colors ${
                                admin.status === 'ACTIVE' 
                                  ? 'text-orange-600 hover:text-orange-700 bg-orange-50 border-orange-200 hover:bg-orange-100' 
                                  : 'text-green-600 hover:text-green-700 bg-green-50 border-green-200 hover:bg-green-100'
                              }`}
                              title={admin.status === 'ACTIVE' ? 'Suspend Admin' : 'Reactivate Admin'}
                            >
                              {admin.status === 'ACTIVE' ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                            </button>
                            <button
                              onClick={() => handleDelete(admin.id)}
                              className="p-2 text-red-600 hover:text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 rounded-lg transition-colors"
                              title="Delete Admin"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Create Admin Modal */}
        <Modal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          title="Add New Admin"
          size="sm"
        >
          <form onSubmit={handleCreateAdmin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number (Optional)</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="input-field"
                placeholder="+251 911 234 567"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
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
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsCreateModalOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-1">
                Create Admin
              </Button>
            </div>
          </form>
        </Modal>

        {/* Assign Group Modal */}
        <Modal
          isOpen={isAssignModalOpen}
          onClose={() => setIsAssignModalOpen(false)}
          title="Manage Group Access"
          size="lg"
        >
          {selectedAdmin && (
            <div className="space-y-6">
              <p className="text-sm text-gray-500">
                Assign <strong className="text-gray-900">{selectedAdmin.name}</strong> to manage specific groups
              </p>

              <div className="space-y-6">
                {/* Existing Assignments */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">Current Assignments</h3>
                  {selectedAdmin.groupLeadership?.length === 0 ? (
                    <div className="p-4 bg-gray-50 rounded-lg text-sm text-gray-500 border border-gray-200">
                      No groups assigned yet.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {selectedAdmin.groupLeadership?.map((assignment: any) => (
                        <div key={assignment.group.id} className="p-4 bg-white rounded-xl border border-gray-200 flex justify-between items-center shadow-sm">
                          <div>
                            <div className="font-semibold text-gray-950">{assignment.group.name}</div>
                            <div className="flex flex-wrap gap-2 mt-2">
                              {assignment.canManageMembers && <span className="text-xs bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded font-medium">Members</span>}
                              {assignment.canManageDeposits && <span className="text-xs bg-green-50 text-green-700 border border-green-100 px-2 py-0.5 rounded font-medium">Deposits</span>}
                              {assignment.canTriggerLottery && <span className="text-xs bg-purple-50 text-purple-700 border border-purple-100 px-2 py-0.5 rounded font-medium">Lottery</span>}
                              {assignment.canManageRules && <span className="text-xs bg-orange-50 text-orange-700 border border-orange-100 px-2 py-0.5 rounded font-medium">Rules</span>}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            onClick={() => handleRemoveGroup(assignment.group.id)}
                            className="text-red-500 hover:text-red-700 p-2"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Assign New Group Form */}
                <div className="border-t border-gray-200 pt-6">
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">Assign New Group</h3>
                  <form onSubmit={handleAssignGroup} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Select Group</label>
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
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <label className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                        <input
                          type="checkbox"
                          checked={assignData.canManageMembers}
                          onChange={(e) => setAssignData({ ...assignData, canManageMembers: e.target.checked })}
                          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 h-4 w-4"
                        />
                        <span className="text-sm font-medium text-gray-700">Manage Members</span>
                      </label>
                      <label className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                        <input
                          type="checkbox"
                          checked={assignData.canManageDeposits}
                          onChange={(e) => setAssignData({ ...assignData, canManageDeposits: e.target.checked })}
                          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 h-4 w-4"
                        />
                        <span className="text-sm font-medium text-gray-700">Manage Deposits</span>
                      </label>
                      <label className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                        <input
                          type="checkbox"
                          checked={assignData.canTriggerLottery}
                          onChange={(e) => setAssignData({ ...assignData, canTriggerLottery: e.target.checked })}
                          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 h-4 w-4"
                        />
                        <span className="text-sm font-medium text-gray-700">Trigger Lottery</span>
                      </label>
                      <label className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                        <input
                          type="checkbox"
                          checked={assignData.canManageRules}
                          onChange={(e) => setAssignData({ ...assignData, canManageRules: e.target.checked })}
                          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 h-4 w-4"
                        />
                        <span className="text-sm font-medium text-gray-700">Manage Rules</span>
                      </label>
                    </div>

                    <div className="pt-4 flex gap-3">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setIsAssignModalOpen(false)}
                        className="flex-1"
                      >
                        Close
                      </Button>
                      <Button type="submit" className="flex-1" disabled={!assignData.groupId}>
                        Assign Access
                      </Button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}
        </Modal>

        {/* Approve Reset Modal */}
        <Modal isOpen={isApproveModalOpen} onClose={() => setIsApproveModalOpen(false)} title="Set Temporary Password" size="sm">
          {selectedResetRequest && (
            <form onSubmit={handleApproveReset} className="space-y-4">
              <p className="text-sm text-gray-600">
                Set a temporary password for <strong>{selectedResetRequest.requester.name}</strong>.
                They will be required to change it on their next login.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Temporary Password</label>
                <input
                  type="text"
                  required
                  minLength={6}
                  value={tempPassword}
                  onChange={e => setTempPassword(e.target.value)}
                  className="input-field font-mono"
                  placeholder="e.g. Temp@1234"
                  autoFocus
                />
                <p className="text-xs text-gray-400 mt-1">Minimum 6 characters. Share this with the admin verbally or via phone.</p>
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="secondary" onClick={() => setIsApproveModalOpen(false)} className="flex-1">Cancel</Button>
                <Button type="submit" className="flex-1" disabled={resetActionLoading}>
                  {resetActionLoading ? 'Approving...' : 'Approve & Set Password'}
                </Button>
              </div>
            </form>
          )}
        </Modal>

        {/* Reject Reset Modal */}
        <Modal isOpen={isRejectModalOpen} onClose={() => setIsRejectModalOpen(false)} title="Reject Reset Request" size="sm">
          {selectedResetRequest && (
            <form onSubmit={handleRejectReset} className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg border border-red-100">
                <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                <p className="text-sm text-red-700">
                  Rejecting the request from <strong>{selectedResetRequest.requester.name}</strong>.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rejection Note (Optional)</label>
                <textarea
                  value={rejectionNote}
                  onChange={e => setRejectionNote(e.target.value)}
                  className="input-field resize-none"
                  rows={3}
                  placeholder="Reason for rejection..."
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="secondary" onClick={() => setIsRejectModalOpen(false)} className="flex-1">Cancel</Button>
                <Button type="submit" variant="danger" className="flex-1" disabled={resetActionLoading}>
                  {resetActionLoading ? 'Rejecting...' : 'Reject Request'}
                </Button>
              </div>
            </form>
          )}
        </Modal>

        {/* Custom Alert Modal */}
        {alertPopup?.isOpen && (
          <Modal
            isOpen={alertPopup.isOpen}
            onClose={() => setAlertPopup(null)}
            title={alertPopup.title}
            size="sm"
          >
            <div className="text-center py-4 space-y-4">
              {alertPopup.type === 'success' && (
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
                  <CheckCircle2 className="h-6 w-6 text-green-600" />
                </div>
              )}
              {alertPopup.type === 'error' && (
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                  <AlertCircle className="h-6 w-6 text-red-600" />
                </div>
              )}
              {alertPopup.type === 'info' && (
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100">
                  <Shield className="h-6 w-6 text-blue-600" />
                </div>
              )}
              <p className="text-sm text-gray-600">{alertPopup.message}</p>
              <div className="pt-2">
                <Button onClick={() => setAlertPopup(null)} variant="secondary" className="w-full">
                  OK
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {/* Custom Confirm Modal */}
        {confirmPopup?.isOpen && (
          <Modal
            isOpen={confirmPopup.isOpen}
            onClose={() => setConfirmPopup(null)}
            title={confirmPopup.title}
            size="sm"
          >
            <div className="text-center py-4 space-y-4">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-orange-100">
                <AlertCircle className="h-6 w-6 text-orange-600" />
              </div>
              <p className="text-sm text-gray-600">{confirmPopup.message}</p>
              <div className="pt-2 flex gap-3">
                <Button
                  onClick={() => setConfirmPopup(null)}
                  variant="secondary"
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    confirmPopup.onConfirm();
                    setConfirmPopup(null);
                  }}
                  variant="danger"
                  className="flex-1"
                >
                  Confirm
                </Button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </DashboardLayout>
  );
}
