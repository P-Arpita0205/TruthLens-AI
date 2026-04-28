import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Lock, Shield, Save, Trash2, AlertTriangle } from 'lucide-react';
import PasswordField from '../components/PasswordField';

export default function Profile() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const navigate = useNavigate();
  const user = useMemo(() => {
    try {
      const rawUser = localStorage.getItem('user');
      if (!rawUser) return null;
      return JSON.parse(rawUser);
    } catch {
      return null;
    }
  }, []);

  const clearLocalSession = () => {
    localStorage.removeItem('auth');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  const readApiResponse = async (response) => {
    const rawBody = await response.text();

    if (!rawBody) {
      return {};
    }

    try {
      return JSON.parse(rawBody);
    } catch {
      return {
        error: response.ok
          ? ''
          : `Request failed with status ${response.status}. Please make sure the backend server is restarted.`
      };
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');

    if (!user?.email) {
      setError('User email not found. Please log in again.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    try {
      setSaving(true);
      const response = await fetch('http://localhost:5000/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          currentPassword,
          newPassword,
          confirmPassword
        })
      });

      const data = await readApiResponse(response);
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update password');
      }

      setMessage('Password updated successfully. Please use the new password next login.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err.message || 'Failed to update password');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProfile = async () => {
    if (!user?.email && !user?.uid) {
      setError('Profile details are missing. Please log in again.');
      setShowDeleteConfirm(false);
      return;
    }

    try {
      setDeletingAccount(true);
      setError('');
      setMessage('');

      const response = await fetch('http://localhost:5000/api/auth/delete-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user?.email || '',
          uid: user?.uid || ''
        })
      });

      const data = await readApiResponse(response);
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete profile');
      }

      clearLocalSession();
      navigate('/auth?mode=signup', { replace: true });
    } catch (err) {
      setError(err.message || 'Failed to delete profile');
      setShowDeleteConfirm(false);
    } finally {
      setDeletingAccount(false);
    }
  };

  return (
    <div className="relative px-6 py-8 lg:px-10">
      <div className="mx-auto max-w-5xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="mb-2 text-4xl font-bold tracking-tight text-white">Account Settings</h1>
          <p className="font-medium text-slate-400">Manage your profile and security preferences.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left Column - User Info */}
        <div className="md:col-span-1 space-y-6">
          <div className="glass-card glass-card-hover p-6 text-center">
            <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 via-sky-500 to-purple-500 shadow-lg shadow-cyan-500/25 ring-4 ring-cyan-400/30">
              <User className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-lg font-bold text-white">{user?.name || 'User'}</h2>
            <p className="mb-4 text-sm font-medium text-slate-400">{user?.email || 'No email found'}</p>
            <div className="inline-flex items-center space-x-2 rounded-full border border-cyan-400/20 bg-gradient-to-r from-cyan-500/15 to-purple-500/15 px-3 py-1 text-xs font-bold text-cyan-200">
              <Shield className="w-3 h-3" />
              <span>Verified Account</span>
            </div>
          </div>

        </div>

        {/* Right Column - Security */}
        <div className="md:col-span-2">
          <div className="glass-card glass-card-hover p-8">
            <div className="mb-6 flex items-center space-x-3 border-b border-white/10 pb-6">
              <Lock className="w-5 h-5 text-cyan-300" />
              <h2 className="text-xl font-bold text-white">Change Password</h2>
            </div>

            <form onSubmit={handlePasswordChange} className="space-y-6">
              {message && <p className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-200">{message}</p>}
              {error && <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-200">{error}</p>}
              <div>
                <PasswordField
                  id="current-password"
                  label="Current Password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  inputClassName="dashboard-input py-3"
                  labelClassName="mb-2 block text-sm font-bold text-slate-200"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <PasswordField
                    id="new-password"
                    label="New Password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    inputClassName="dashboard-input py-3"
                    labelClassName="mb-2 block text-sm font-bold text-slate-200"
                  />
                </div>
                <div>
                  <PasswordField
                    id="confirm-new-password"
                    label="Confirm New Password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    inputClassName="dashboard-input py-3"
                    labelClassName="mb-2 block text-sm font-bold text-slate-200"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="dashboard-button-primary gap-2 px-6 py-3"
                >
                  <Save className="w-4 h-4" />
                  <span>{saving ? 'Updating...' : 'Update Password'}</span>
                </button>
              </div>
            </form>
          </div>

          <div className="mt-8 rounded-2xl border border-red-500/30 bg-red-500/5 p-8 shadow-lg shadow-red-500/10 backdrop-blur-xl">
            <div className="flex items-start justify-between gap-4 flex-col sm:flex-row sm:items-center">
              <div>
                <div className="flex items-center space-x-3 mb-2">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                  <h2 className="text-xl font-bold text-white">Delete Profile</h2>
                </div>
                <p className="text-sm font-medium text-red-100/80">
                  This will permanently remove your profile, login account, and saved analysis data from the database.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="dashboard-button-danger space-x-2 px-5 py-3"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete Profile</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#07101f]/95 p-6 text-white shadow-2xl shadow-black/50 backdrop-blur-2xl">
            <div className="flex items-start space-x-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-500/15">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Warning</h3>
                <p className="mt-2 text-sm font-medium text-slate-300">
                  Your profile will be deleted permanently. Press Cancel to stay on this page, or OK to delete all your user information from the database.
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deletingAccount}
                className="dashboard-button-secondary px-4 py-2.5 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteProfile}
                disabled={deletingAccount}
                className="dashboard-button-danger px-4 py-2.5 disabled:opacity-60"
              >
                {deletingAccount ? 'Deleting...' : 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
