'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Users,
  Calendar,
  CircleDollarSign,
  Clock,
  MapPin,
  Settings,
  Trash2,
  Ticket,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import StatusBadge from '@/components/ui/StatusBadge';
import Modal from '@/components/ui/Modal';
import PhotoUpload from '@/components/ui/PhotoUpload';
import LocationPicker from '@/components/ui/LocationPicker';
import { CbeAccountSettings } from '@/components/ui/CbeVerifyPanel';
import { updateGroup, softDeleteGroup, updateGroupCbeAccounts, getMediaUrl } from '@/lib/api';
import type { GroupDetail } from '@/lib/api';

interface GroupHeaderProps {
  group: GroupDetail;
  groupId: string;
  isOwnerOrSuper: boolean;
  canTriggerLottery: boolean;
  drawLoading: boolean;
  onDrawLottery: () => void;
  onGroupUpdated: (group: GroupDetail) => void;
  onCbeAccountsSaved: (accounts: string[]) => void;
  notifySuccess: (msg: string) => void;
  notifyError: (msg: string) => void;
}

function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(0);
  const prevRef = useRef(0);
  useEffect(() => {
    const from = prevRef.current;
    prevRef.current = target;
    if (from === target) {
      setValue(target);
      return;
    }
    let frame: number;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(from + (target - from) * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);
  return value;
}

function StatCard({ icon, label, value, delay, accent }: { icon: React.ReactNode; label: string; value: string; delay: number; accent: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={`flex items-center gap-3 p-3 rounded-xl ${accent} bg-opacity-40`}
    >
      <div className={`p-2 rounded-lg ${accent}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
        <p className="text-sm font-semibold text-gray-900 dark:text-white/90">{value}</p>
      </div>
    </motion.div>
  );
}

export default function GroupHeader({
  group,
  groupId,
  isOwnerOrSuper,
  canTriggerLottery,
  drawLoading,
  onDrawLottery,
  onGroupUpdated,
  onCbeAccountsSaved,
  notifySuccess,
  notifyError,
}: GroupHeaderProps) {
  const router = useRouter();
  const [showEditModal, setShowEditModal] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    contributionAmount: '',
    maxMembers: '',
    cycleDuration: 'Weekly',
    photoUrl: '',
    endDate: '',
    physicalAddress: '',
    latitude: '',
    longitude: '',
  });

  const openEdit = () => {
    setEditForm({
      name: group.name,
      description: group.description || '',
      contributionAmount: String(group.contributionAmount),
      maxMembers: String(group.maxMembers),
      cycleDuration: group.cycleDuration || 'Weekly',
      photoUrl: group.photoUrl || '',
      endDate: group.endDate ? new Date(group.endDate).toISOString().split('T')[0] : '',
      physicalAddress: group.physicalAddress || '',
      latitude: group.latitude ? String(group.latitude) : '',
      longitude: group.longitude ? String(group.longitude) : '',
    });
    setShowEditModal(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdating(true);
    try {
      let cycleType: string | undefined;
      if (editForm.cycleDuration) {
        switch (editForm.cycleDuration.toLowerCase()) {
          case 'weekly': cycleType = 'weekly'; break;
          case 'bi-weekly':
          case 'biweekly': cycleType = 'biweekly'; break;
          case 'monthly': cycleType = 'monthly'; break;
          default: cycleType = 'monthly';
        }
      }

      const updated = await updateGroup(groupId, {
        name: editForm.name,
        description: editForm.description || undefined,
        contributionAmount: Number(editForm.contributionAmount),
        maxMembers: Number(editForm.maxMembers),
        cycleType,
        photoUrl: editForm.photoUrl || undefined,
        endDate: editForm.endDate || undefined,
        physicalAddress: editForm.physicalAddress || undefined,
        latitude: editForm.latitude ? Number(editForm.latitude) : undefined,
        longitude: editForm.longitude ? Number(editForm.longitude) : undefined,
      });
      setShowEditModal(false);
      notifySuccess('Group information updated successfully.');
      onGroupUpdated(updated as GroupDetail);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      notifyError(axiosErr.response?.data?.message || 'Failed to update group information.');
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async () => {
    const groupName = window.prompt(`To delete this group, please type its name: "${group.name}"`);
    if (groupName !== group.name) {
      if (groupName !== null) window.alert('Group name did not match. Deletion cancelled.');
      return;
    }
    try {
      await softDeleteGroup(groupId);
      router.push('/groups');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      notifyError(axiosErr.response?.data?.message || 'Failed to delete group.');
    }
  };

  const membersCount = useCountUp(group.membersCount);
  const contributionCount = useCountUp(group.contributionAmount);
  const cycleCount = useCountUp(group.currentCycle);

  // Uploaded files can go missing (e.g. ephemeral server disk after a
  // redeploy) — fall back to initials instead of a broken image icon.
  const [imgFailed, setImgFailed] = useState(false);
  useEffect(() => setImgFailed(false), [group.photoUrl]);
  const initials = group.name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <>
      <motion.div
        className="card mb-6"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="flex items-start gap-4 min-w-0">
            {group.photoUrl && !imgFailed ? (
              <img
                src={getMediaUrl(group.photoUrl)}
                alt={group.name}
                onError={() => setImgFailed(true)}
                className="w-20 h-20 rounded-lg object-cover bg-gray-100 dark:bg-white/[0.08] flex-shrink-0"
              />
            ) : (
              <div className="w-20 h-20 rounded-lg bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center flex-shrink-0 text-xl font-bold">
                {initials}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white/90 break-words">{group.name}</h1>
                <StatusBadge status={group.status} />
              </div>
              {group.description && (
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{group.description}</p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                {group.physicalAddress && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {group.physicalAddress}
                    {group.latitude && group.longitude && (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${group.latitude},${group.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary-600 dark:text-brand-400 hover:underline ml-1"
                      >
                        (Map)
                      </a>
                    )}
                  </span>
                )}
                {group.endDate && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    Ends: {new Date(group.endDate).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 w-full md:w-auto md:flex-shrink-0">
            {isOwnerOrSuper && (
              <Button variant="secondary" onClick={openEdit} className="flex-1 min-w-[9.5rem] justify-center md:flex-none md:min-w-0">
                <Settings className="h-4 w-4 mr-2" />
                Edit Info
              </Button>
            )}
            {isOwnerOrSuper && (
              <Button variant="danger" onClick={handleDelete} className="flex-1 min-w-[9.5rem] justify-center md:flex-none md:min-w-0">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Group
              </Button>
            )}
            {canTriggerLottery && (
              <Button onClick={onDrawLottery} loading={drawLoading} className="flex-1 min-w-[9.5rem] justify-center md:flex-none md:min-w-0">
                <Ticket className="h-4 w-4 mr-2" />
                Draw Lottery
              </Button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6 pt-6 border-t border-gray-100 dark:border-gray-800">
          <StatCard
            delay={0.1}
            accent="bg-blue-50 dark:bg-blue-light-500/10 text-blue-600 dark:text-blue-light-400"
            icon={<Users className="h-5 w-5" />}
            label="Members"
            value={`${membersCount}/${group.maxMembers}`}
          />
          <StatCard
            delay={0.18}
            accent="bg-green-50 dark:bg-success-500/10 text-green-600 dark:text-success-400"
            icon={<CircleDollarSign className="h-5 w-5" />}
            label="Contribution"
            value={`ETB ${contributionCount.toLocaleString()}`}
          />
          <StatCard
            delay={0.26}
            accent="bg-purple-50 dark:bg-theme-purple-500/10 text-purple-600 dark:text-theme-purple-500"
            icon={<Calendar className="h-5 w-5" />}
            label="Cycle"
            value={`${cycleCount}/${group.totalCycles}`}
          />
          <StatCard
            delay={0.34}
            accent="bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400"
            icon={<Clock className="h-5 w-5" />}
            label="Next Draw"
            value={group.nextDrawDate || 'TBD'}
          />
        </div>
      </motion.div>

      {/* Edit Group Info Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Equb Group Details"
        size="md"
      >
        <form onSubmit={handleUpdate} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              Group Profile Image
            </label>
            <PhotoUpload
              value={editForm.photoUrl}
              onChange={(url) => setEditForm({ ...editForm, photoUrl: url })}
              name={editForm.name || 'Group'}
              size="md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Group Name
            </label>
            <input
              type="text"
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              className="input-field"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Contribution Per Share (ETB)
              </label>
              <input
                type="number"
                value={editForm.contributionAmount}
                onChange={(e) => setEditForm({ ...editForm, contributionAmount: e.target.value })}
                className="input-field"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Max Members
              </label>
              <input
                type="number"
                value={editForm.maxMembers}
                onChange={(e) => setEditForm({ ...editForm, maxMembers: e.target.value })}
                className="input-field"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Cycle Duration
            </label>
            <select
              value={editForm.cycleDuration}
              onChange={(e) => setEditForm({ ...editForm, cycleDuration: e.target.value })}
              className="input-field"
            >
              <option value="Weekly">Weekly</option>
              <option value="Bi-Weekly">Bi-Weekly</option>
              <option value="Monthly">Monthly</option>
            </select>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                End Date
              </label>
              <input
                type="date"
                value={editForm.endDate}
                onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })}
                className="input-field"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Physical Location
            </label>
            <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-3 bg-gray-50 dark:bg-white/[0.04] flex items-center justify-between">
              <div className="flex-1 min-w-0 pr-4">
                {editForm.physicalAddress ? (
                  <>
                    <p className="text-sm font-medium text-gray-800 dark:text-white/90 truncate">
                      {editForm.physicalAddress}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      GPS: {Number(editForm.latitude).toFixed(6)}, {Number(editForm.longitude).toFixed(6)}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400 italic">No physical location assigned</p>
                )}
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowLocationPicker(true)}
                className="flex-shrink-0 flex items-center gap-1.5 text-xs py-1.5 px-3"
              >
                <MapPin className="h-3.5 w-3.5" />
                Select on Map
              </Button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Description (Optional)
            </label>
            <textarea
              value={editForm.description}
              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              className="input-field"
              rows={3}
              placeholder="Brief description of the group..."
            />
          </div>

          <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2 mb-2 mt-4">
              <Zap className="h-4 w-4 text-blue-600 dark:text-blue-light-400" />
              <label className="block text-sm font-semibold text-blue-900">
                CBE Auto-Verification Accounts
              </label>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-light-500/10 border border-blue-100 rounded-lg mb-4">
              <p className="text-xs text-blue-700">
                These accounts are used to verify member deposits automatically via CBE Direct API using FT numbers. Only CBE accounts starting with 1000 are supported.
              </p>
            </div>
            <CbeAccountSettings
              groupId={groupId}
              accounts={group.cbeAccountNumbers || []}
              onSaveFn={updateGroupCbeAccounts}
              onSaved={(newAccounts) => {
                onCbeAccountsSaved(newAccounts);
                notifySuccess('CBE account numbers saved successfully!');
              }}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowEditModal(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={updating}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      <LocationPicker
        isOpen={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
        initialLatitude={editForm.latitude ? Number(editForm.latitude) : undefined}
        initialLongitude={editForm.longitude ? Number(editForm.longitude) : undefined}
        initialAddress={editForm.physicalAddress}
        onConfirm={(loc) => {
          setEditForm({
            ...editForm,
            physicalAddress: loc.address,
            latitude: String(loc.latitude),
            longitude: String(loc.longitude),
          });
        }}
      />
    </>
  );
}
