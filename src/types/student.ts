
export interface Student {
  id?: string;        // Khớp với STT
  studentId: string; // Khớp với MSSV
  name: string;      // Khớp với HoVaTen
  gender?: string;   // Khớp với GioiTinh (Nam/Nữ)
  className: string; // Khớp với Lop
  stt?: number;        // Thêm trường STT
  isAbsent?: boolean;  // Thêm trường Trạng thái Vắng
  isLate?: boolean;
  room?: string;
  truongPhong?: string | null;
  ghiChu?: string | null;
}

export type TabType = 'add' | 'manage' | 'rooms' | 'scoring' | 'history' | 'users';
