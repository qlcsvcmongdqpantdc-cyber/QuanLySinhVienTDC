import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { AddStudent } from './components/AddStudent';
import { Login } from './components/Login';
import { UserManagement } from './components/UserManagement';
import { ManageStudents } from './components/ManageStudents';
import { RoomAllocation } from './components/RoomAllocation';
import { RoomScoring } from './components/RoomScoring';
import { CourseHistory } from './components/CourseHistory';
import { supabase } from './supabaseClient';
import type { Student, TabType } from './types/student';
import type { User } from './types/auth';

const HARDCODED_ADMIN: User = {
  id: 'admin-fixed',
  username: 'admin',
  password: '123',
  name: 'Quản Trị Viên (Admin)',
  role: 'admin',
};

export function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem('currentUser');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const [users, setUsers] = useState<User[]>([HARDCODED_ADMIN]);
  const [students, setStudents] = useState<Student[]>([]);
  const [activeTab, setActiveTab] = useState<string>('add');

  // 1. Tải danh sách sinh viên từ CSDL Supabase
  const fetchStudentsFromSupabase = async () => {
    const { data, error } = await supabase
      .from('DanhSachSinhVien')
      .select('*')
      .order('STT', { ascending: true });

    if (error) {
      console.error('Lỗi lấy danh sách sinh viên:', error.message);
    } else if (data) {
      const mappedStudents: Student[] = data.map((item) => ({
        id: String(item.STT || item.MSSV || item.id || ''),
        studentId: String(item.MSSV || item.MSV || item.studentId || '').trim(),
        name: String(item.HoVaTen || item.Ten || item.name || ''),
        gender: String(item.GioiTinh || item.gender || 'Nam'),
        className: String(item.Lop || item.className || ''),
        room: item.Phong || item.TenPhong || item.room || null,
        isAbsent:
          item.Vang === 'x' ||
          item.Vang === '1' ||
          item.Vang === true ||
          item.Vang === 'true',
        isLate:
          item.DiTre === 'x' ||
          item.DiTre === '1' ||
          item.DiTre === true ||
          item.DiTre === 'true',
        truongPhong: item.GhiChu === 'x' ? 'x' : null, // Đã đổi từ TruongPhong sang GhiChu
      }));
      setStudents(mappedStudents);
    }
  };

  // 2. Lấy danh sách User
  const fetchUsersFromSupabase = async () => {
    const { data, error } = await supabase.from('User').select('*');
    if (!error && data) {
      const mappedUsers: User[] = data.map((item) => ({
        id: String(item.id),
        username: item.UserName,
        password: item.PassW,
        name: item.HoTen,
        role: item.VaiTro || 'user',
      }));
      setUsers([HARDCODED_ADMIN, ...mappedUsers]);
    }
  };

  useEffect(() => {
    fetchUsersFromSupabase();
    fetchStudentsFromSupabase();
  }, []);

  // 3. Lưu sinh viên mới từ Excel
  const handleAddStudents = async (newStudents: Student[]) => {
    const formattedData = newStudents.map((s) => ({
      MSSV: s.studentId ? String(s.studentId).trim() : null,
      HoVaTen: s.name,
      GioiTinh: s.gender || 'Nam',
      Lop: s.className,
      Phong: s.room || null,
      Vang: null,
      DiTre: null,
      GhiChu: null, // Đã đổi từ TruongPhong sang GhiChu
    }));

    const { error } = await supabase.from('DanhSachSinhVien').insert(formattedData);

    if (error) {
      throw new Error(error.message);
    } else {
      await fetchStudentsFromSupabase();
    }
  };

  // 4. Tích Vắng / Đi Trễ
  const handleToggleAttendance = async (targetId: string, field: 'isAbsent' | 'isLate') => {
    const currentStudent = students.find((s) => s.id === targetId || s.studentId === targetId);
    if (!currentStudent) return;

    const newStatus = !currentStudent[field];

    setStudents((prev) =>
      prev.map((s) => {
        if (s.id === targetId || s.studentId === targetId) {
          return { ...s, [field]: newStatus };
        }
        return s;
      })
    );

    const updatePayload: Record<string, string | null> = {};
    if (field === 'isAbsent') {
      updatePayload.Vang = newStatus ? 'x' : null;
    } else if (field === 'isLate') {
      updatePayload.DiTre = newStatus ? 'x' : null;
    }

    let query = supabase.from('DanhSachSinhVien').update(updatePayload);
    
    const mssvVal = currentStudent.studentId ? String(currentStudent.studentId).trim() : null;
    const sttVal = currentStudent.id ? Number(currentStudent.id) : null;

    if (mssvVal && mssvVal !== 'undefined') {
      query = query.eq('MSSV', mssvVal);
    } else if (sttVal && !isNaN(sttVal)) {
      query = query.eq('STT', sttVal);
    }

    const { data, error } = await query.select();

    if (error) {
      console.error('Lỗi lưu trạng thái điểm danh:', error.message);
      alert('Không thể lưu trạng thái vào CSDL: ' + error.message);
      fetchStudentsFromSupabase();
    } else if (!data || data.length === 0) {
      alert(`Cảnh báo: Không tìm thấy sinh viên có MSSV/STT là "${mssvVal || sttVal}" trong CSDL để điểm danh!`);
      fetchStudentsFromSupabase();
    }
  };

  // 5. Xử lý lưu Ghi chú và Cột Phòng vào Supabase
  const handleSetRoomLeader = async (
    leaderStudentId: string | null,
    roomStudentKeys: string[],
    roomName?: string
  ) => {
    const cleanLeaderId = leaderStudentId ? String(leaderStudentId).trim() : null;
    const cleanRoomStudentKeys = roomStudentKeys.map((k) => String(k).trim());

    setStudents((prev) =>
      prev.map((s) => {
        const sKey = String(s.studentId || s.id).trim();
        if (cleanRoomStudentKeys.includes(sKey)) {
          return {
            ...s,
            truongPhong: cleanLeaderId && sKey === cleanLeaderId ? 'x' : null,
            ...(roomName ? { room: roomName } : {}),
          };
        }
        return s;
      })
    );

    for (const stKey of cleanRoomStudentKeys) {
      const isLeader = cleanLeaderId && stKey === cleanLeaderId;

      const targetStudent = students.find(
        (s) => String(s.studentId || s.id).trim() === stKey
      );

      if (!targetStudent) continue;

      const mssvValue = targetStudent.studentId ? String(targetStudent.studentId).trim() : null;
      const sttValue = targetStudent.id ? Number(targetStudent.id) : null;

      const updatePayload: Record<string, any> = {
        GhiChu: isLeader ? 'x' : null, // Đã đổi từ TruongPhong sang GhiChu
      };

      if (roomName) {
        updatePayload.Phong = roomName;
      } else if (targetStudent.room) {
        updatePayload.Phong = targetStudent.room;
      }

      let query = supabase
        .from('DanhSachSinhVien')
        .update(updatePayload);

      if (mssvValue && mssvValue !== 'undefined') {
        query = query.eq('MSSV', mssvValue);
      } else if (sttValue && !isNaN(sttValue)) {
        query = query.eq('STT', sttValue);
      }

      const { error } = await query.select();

      if (error) {
        console.error(`Lỗi cập nhật CSDL cho SV ${stKey}:`, error.message);
        alert(`Lỗi CSDL khi cập nhật Phòng/Ghi chú: ${error.message}`);
        break;
      }
    }
  };

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('currentUser', JSON.stringify(user));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('currentUser');
    setActiveTab('add');
  };

  const handleAddUser = async (newUser: User) => {
    const { error } = await supabase.from('User').insert([
      {
        HoTen: newUser.name,
        MaSo: `GV${Math.floor(100 + Math.random() * 900)}`,
        UserName: newUser.username,
        PassW: newUser.password,
        VaiTro: newUser.role,
      },
    ]);

    if (error) {
      alert('Lỗi thêm user: ' + error.message);
    } else {
      fetchUsersFromSupabase();
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (userId === HARDCODED_ADMIN.id) {
      alert('Không thể xóa tài khoản Admin gán cứng!');
      return;
    }
    const { error } = await supabase.from('User').delete().eq('id', Number(userId));
    if (!error) fetchUsersFromSupabase();
  };

  if (!currentUser) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', background: '#f8fafc', overflow: 'hidden' }}>
      <Sidebar
        activeTab={activeTab as TabType}
        setActiveTab={(tab) => setActiveTab(tab)}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      <main style={{ flex: 1, padding: '32px', overflowY: 'auto', height: '100vh' }}>
        {activeTab === 'add' && (
          <AddStudent students={students} onAddStudents={handleAddStudents} />
        )}

        {activeTab === 'manage' && (
          <ManageStudents
            students={students}
            onToggleAttendance={handleToggleAttendance}
            onRefresh={fetchStudentsFromSupabase}
          />
        )}

        {activeTab === 'rooms' && (
          <RoomAllocation
            students={students}
            setStudents={setStudents}
            onSetRoomLeader={handleSetRoomLeader}
          />
        )}

        {activeTab === 'scoring' && (
          <RoomScoring students={students} />
        )}

        {activeTab === 'history' && (
          <CourseHistory selectedCourseKey="" />
        )}

        {activeTab === 'users' && currentUser.role === 'admin' && (
          <UserManagement
            users={users}
            onAddUser={handleAddUser}
            onDeleteUser={handleDeleteUser}
            currentUser={currentUser}
          />
        )}
      </main>
    </div>
  );
}

export default App;