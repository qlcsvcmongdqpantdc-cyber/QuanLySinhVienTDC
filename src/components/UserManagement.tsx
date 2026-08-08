import { useState } from 'react';
import { UserPlus, Shield, UserCheck, Trash2 } from 'lucide-react';
import type { User, Role } from '../types/auth';

interface UserManagementProps {
  users: User[];
  onAddUser: (newUser: User) => void;
  onDeleteUser: (userId: string) => void;
  currentUser: User;
}

export const UserManagement = ({ users, onAddUser, onDeleteUser, currentUser }: UserManagementProps) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('user');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (users.some((u) => u.username === username.trim())) {
      setError('Tài khoản đã tồn tại trên hệ thống!');
      return;
    }

    const newUser: User = {
      id: Date.now().toString(),
      username: username.trim(),
      password,
      name: name.trim(),
      role,
    };

    onAddUser(newUser);
    setUsername('');
    setPassword('');
    setName('');
    setRole('user');
    setError('');
    setSuccess('Cấp tài khoản Giáo viên thành công!');
    setTimeout(() => setSuccess(''), 3000);
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e293b', marginBottom: '24px' }}>
        Quản Lý Tài Khoản Giáo Viên & Cán Bộ
      </h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
        {/* Form tạo tài khoản Giáo viên */}
        <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', height: 'fit-content' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <UserPlus size={18} color="#2563eb" /> Cấp Tài Khoản Mới
          </h3>

          {error && <div style={{ background: '#fef2f2', color: '#dc2626', padding: '8px 12px', borderRadius: '6px', fontSize: '13px', marginBottom: '12px' }}>{error}</div>}
          {success && <div style={{ background: '#f0fdf4', color: '#16a34a', padding: '8px 12px', borderRadius: '6px', fontSize: '13px', marginBottom: '12px' }}>{success}</div>}

          <form onSubmit={handleCreateUser}>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>Tên đăng nhập / Mã CB</label>
              <input type="text" required value={username} onChange={(e) => setUsername(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>Mật khẩu</label>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>Họ và tên Giáo viên</label>
              <input type="text" required value={name} onChange={(e) => setName(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>Chức vụ / Quyền hạn</label>
              <select value={role} onChange={(e) => setRole(e.target.value as Role)} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}>
                <option value="user">Giáo Viên Chủ Nhiệm (User)</option>
                <option value="admin">Ban Quản Lý (Admin)</option>
              </select>
            </div>

            <button type="submit" style={{ width: '100%', padding: '10px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
              Tạo Tài Khoản
            </button>
          </form>
        </div>

        {/* Danh sách Cán bộ / Giáo viên */}
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '13px' }}>
                <th style={{ padding: '14px 16px' }}>Họ và Tên</th>
                <th style={{ padding: '14px 16px' }}>Tài Khoản</th>
                <th style={{ padding: '14px 16px' }}>Vai Trò</th>
                <th style={{ padding: '14px 16px', textAlign: 'right' }}>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '14px 16px', fontWeight: 600 }}>GV. {u.name}</td>
                  <td style={{ padding: '14px 16px', color: '#64748b' }}>{u.username}</td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{
                      padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold',
                      background: u.role === 'admin' ? '#fef3c7' : '#e0f2fe',
                      color: u.role === 'admin' ? '#d97706' : '#0369a1',
                      display: 'inline-flex', alignItems: 'center', gap: '4px'
                    }}>
                      {u.role === 'admin' ? <Shield size={12} /> : <UserCheck size={12} />}
                      {u.role === 'admin' ? 'BAN QUẢN LÝ' : 'GIÁO VIÊN'}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                    {u.id !== currentUser.id && (
                      <button
                        onClick={() => onDeleteUser(u.id)}
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                        title="Xóa tài khoản"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
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