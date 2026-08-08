import React, { useState, useEffect, useMemo } from 'react';
import { ClipboardCheck, Search, ShieldAlert, DoorClosed, RefreshCw, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../supabaseClient';
import type { Student } from '../types/student';
import './RoomScoring.css';

type ScoringStudent = Student & { room?: string; roomName?: string; gender?: string };

const DEFAULT_VIOLATIONS = [
  { code: 'V', displayCode: 'V', label: '1. Điểm danh: Không phép (V)', penalty: 2 },
  { code: 'P_DD', displayCode: 'P', label: '1. Điểm danh: Có phép (P)', penalty: 1 },
  { code: 'K', displayCode: 'K', label: '2. Thể dục: Không phép (K)', penalty: 2 },
  { code: 'P_TD', displayCode: 'P', label: '2. Thể dục: Có phép (P)', penalty: 1 },
  { code: 'D', displayCode: 'D', label: '3. Gác đêm: Không phép (D)', penalty: 2 },
  { code: 'P_GD', displayCode: 'P', label: '3. Gác đêm: Có phép (P)', penalty: 1 },
  { code: 'N', displayCode: 'N', label: '4. Nội vụ: Không sắp xếp (N)', penalty: 1 },
];

interface RecordEntry {
  code: string;
  displayCode: string;
  penalty: number;
}

type ScoringMap = Record<string, Record<number, RecordEntry[]>>;

interface RoomScoringProps {
  students: Student[];
}

export const RoomScoring: React.FC<RoomScoringProps> = ({ students = [] }) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedRoom, setSelectedRoom] = useState<string>('Tất cả');
  const [scores, setScores] = useState<ScoringMap>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<boolean>(false);

  // Danh sách các lỗi (bao gồm lỗi mặc định và lỗi tự chọn thêm vào)
  const [violations, setViolations] = useState(DEFAULT_VIOLATIONS);

  const processedStudents = useMemo<ScoringStudent[]>(() => {
    if (!students || students.length === 0) return [];
    const hasExistingRoom = students.some((s: ScoringStudent) => s.room || s.roomName);

    if (hasExistingRoom) {
      return (students as ScoringStudent[]).map((st) => ({
        ...st,
        room: (st.roomName || st.room || 'Phòng 01').trim(),
      }));
    }

    const femaleList = (students as ScoringStudent[]).filter(
      (s) => s.gender?.toLowerCase() === 'nữ' || s.gender?.toLowerCase() === 'nu'
    );
    const maleList = (students as ScoringStudent[]).filter(
      (s) => s.gender?.toLowerCase() !== 'nữ' && s.gender?.toLowerCase() !== 'nu'
    );

    const result: ScoringStudent[] = [];
    femaleList.forEach((st, idx) => {
      const roomNum = Math.floor(idx / 12) + 1;
      result.push({ ...st, room: `Phòng ${roomNum < 10 ? '0' + roomNum : roomNum}` });
    });

    const startMaleRoom = femaleList.length > 0 ? 2 : 1;
    maleList.forEach((st, idx) => {
      const roomNum = Math.floor(idx / 12) + startMaleRoom;
      result.push({ ...st, room: `Phòng ${roomNum < 10 ? '0' + roomNum : roomNum}` });
    });

    return result;
  }, [students]);

  useEffect(() => {
    const fetchScoresFromSupabase = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.from('ChamDiem').select('*');
        if (error) {
          console.error('Lỗi lấy dữ liệu:', error);
          return;
        }

        if (data && data.length > 0) {
          const loadedScores: ScoringMap = {};
          const loadedNotes: Record<string, string> = {};
          const extraViolationsMap = new Map<string, { code: string; displayCode: string; label: string; penalty: number }>();

          data.forEach((row: any) => {
            const msv = String(row.MSV);
            loadedNotes[msv] = row.GhiChu || '';
            loadedScores[msv] = {};
            for (let day = 1; day <= 10; day++) {
              const dayValue = row[String(day)];
              if (dayValue) {
                const codes = String(dayValue).split(',');
                const dayEntries: RecordEntry[] = [];
                codes.forEach((c) => {
                  const trimmedCode = c.trim();
                  const target = violations.find((v) => v.code === trimmedCode || v.displayCode === trimmedCode);
                  if (target) {
                    dayEntries.push({ code: target.code, displayCode: target.displayCode, penalty: target.penalty });
                  } else if (trimmedCode) {
                    // Nếu trong DB có mã tự chọn cũ, tự động khôi phục vào danh sách
                    if (!extraViolationsMap.has(trimmedCode)) {
                      extraViolationsMap.set(trimmedCode, {
                        code: trimmedCode,
                        displayCode: trimmedCode,
                        label: `Tự chọn: ${trimmedCode}`,
                        penalty: 1,
                      });
                    }
                    dayEntries.push({ code: trimmedCode, displayCode: trimmedCode, penalty: 1 });
                  }
                });
                if (dayEntries.length > 0) loadedScores[msv][day] = dayEntries;
              }
            }
          });

          if (extraViolationsMap.size > 0) {
            setViolations((prev) => [...prev, ...Array.from(extraViolationsMap.values())]);
          }

          setScores(loadedScores);
          setNotes(loadedNotes);
        }
      } catch (err) {
        console.error('Lỗi kết nối:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchScoresFromSupabase();
  }, []);

  const calculateFinalScore = (studentKey: string) => {
    const studentData = scores[studentKey];
    if (!studentData) return 10;
    let totalPenalty = 0;
    Object.values(studentData).forEach((dayData) => {
      dayData.forEach((item) => { totalPenalty += item.penalty; });
    });
    return Math.max(0, 10 - totalPenalty);
  };

  const saveToSupabase = async (msv: string, hoVaTen: string, updatedScoresForStudent: Record<number, RecordEntry[]>, noteValue: string) => {
    const finalScore = (() => {
      let penalty = 0;
      Object.values(updatedScoresForStudent || {}).forEach((dayData) => {
        dayData.forEach((item) => { penalty += item.penalty; });
      });
      return Math.max(0, 10 - penalty);
    })();

    const recordPayload: Record<string, any> = {
      MSV: msv,
      HoVaTen: hoVaTen,
      DiemNeNep: finalScore,
      GhiChu: noteValue || '',
    };

    for (let day = 1; day <= 10; day++) {
      const dayViolations = updatedScoresForStudent[day] || [];
      recordPayload[String(day)] = dayViolations.map((v) => v.displayCode).join(',') || null;
    }

    await supabase.from('ChamDiem').upsert(recordPayload, { onConflict: 'MSV' });
  };

  const handleToggleViolation = (student: ScoringStudent, day: number, code: string, displayCode: string, penalty: number) => {
    const studentKey = String(student.studentId || student.id);
    setScores((prev) => {
      const studentData = prev[studentKey] || {};
      const dayData = studentData[day] || [];
      const exists = dayData.some((item) => item.code === code);
      const updatedDayData = exists ? dayData.filter((item) => item.code !== code) : [...dayData, { code, displayCode, penalty }];
      const updatedStudentScores = { ...studentData, [day]: updatedDayData };

      saveToSupabase(studentKey, student.name, updatedStudentScores, notes[studentKey] || '');
      return { ...prev, [studentKey]: updatedStudentScores };
    });
  };

  const handleNoteBlur = (student: ScoringStudent, newNote: string) => {
    const studentKey = String(student.studentId || student.id);
    setNotes((prev) => ({ ...prev, [studentKey]: newNote }));
    saveToSupabase(studentKey, student.name, scores[studentKey] || '', newNote);
  };

  // Xử lý khi chọn từ dropdown trong ô
  const handleSelectChange = (student: ScoringStudent, day: number, selectedValue: string, eventTarget: HTMLSelectElement) => {
    if (!selectedValue) return;

    if (selectedValue === 'ADD_CUSTOM') {
      const codeInput = prompt('Nhập mã/ký tự lỗi tự chọn (VD: OT, VSTH...):');
      if (!codeInput || !codeInput.trim()) {
        eventTarget.value = '';
        return;
      }
      const penaltyInput = prompt('Nhập số điểm trừ cho lỗi này (VD: 1, 1.5, 2...):', '1');
      const penalty = parseFloat(penaltyInput || '1');
      if (isNaN(penalty) || penalty <= 0) {
        alert('Số điểm trừ không hợp lệ!');
        eventTarget.value = '';
        return;
      }

      const formattedCode = codeInput.trim().toUpperCase();
      const newRule = {
        code: formattedCode,
        displayCode: formattedCode,
        label: `Tự chọn: ${formattedCode}`,
        penalty: penalty,
      };

      // Nếu mã này chưa có trong danh sách tổng thì thêm vào
      if (!violations.some((v) => v.code === newRule.code)) {
        setViolations((prev) => [...prev, newRule]);
      }

      handleToggleViolation(student, day, newRule.code, newRule.displayCode, newRule.penalty);
    } else {
      const target = violations.find((v) => v.code === selectedValue);
      if (target) {
        handleToggleViolation(student, day, target.code, target.displayCode, target.penalty);
      }
    }
    eventTarget.value = '';
  };

  const { roomList, roomCounts } = useMemo(() => {
    const counts: Record<string, number> = { 'Tất cả': processedStudents.length };
    const rooms = new Set<string>();

    processedStudents.forEach((s) => {
      if (s.room) {
        rooms.add(s.room);
        counts[s.room] = (counts[s.room] || 0) + 1;
      }
    });

    const sortedRooms = Array.from(rooms).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    );

    return { roomList: ['Tất cả', ...sortedRooms], roomCounts: counts };
  }, [processedStudents]);

  const filteredStudents = useMemo(() => {
    return processedStudents.filter((s) => {
      const matchRoom = selectedRoom === 'Tất cả' || s.room === selectedRoom;
      const search = searchTerm.toLowerCase().trim();
      const matchSearch = !search || s.name.toLowerCase().includes(search) || (s.studentId && s.studentId.toLowerCase().includes(search));
      return matchRoom && matchSearch;
    });
  }, [processedStudents, selectedRoom, searchTerm]);

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    const rooms = Array.from(new Set(processedStudents.map((s) => s.room || 'PhongKhac'))).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    );

    if (rooms.length === 0) {
      alert('Không có dữ liệu sinh viên để xuất Excel!');
      return;
    }

    rooms.forEach((roomName) => {
      const roomStudents = processedStudents.filter((s) => s.room === roomName);
      const excelData = roomStudents.map((st, idx) => {
        const studentKey = String(st.studentId || st.id || idx);
        const finalScore = calculateFinalScore(studentKey);
        const studentScores = scores[studentKey] || {};

        const row: Record<string, any> = {
          'STT': idx + 1,
          'MSV': st.studentId || st.id || '',
          'Họ và Tên': st.name || '',
          'Phòng': st.room || '',
          'Điểm Nề Nếp': finalScore,
        };

        for (let day = 1; day <= 10; day++) {
          row[`Ngày ${day}`] = (studentScores[day] || []).map((e) => e.displayCode).join(', ');
        }
        row['Ghi chú'] = notes[studentKey] || '';
        return row;
      });

      const ws = XLSX.utils.json_to_sheet(excelData);
      const safeSheetName = roomName.replace(/[\/?*[\]\\]/g, '_').substring(0, 31);
      XLSX.utils.book_append_sheet(wb, ws, safeSheetName);
    });

    XLSX.writeFile(wb, `Cham_Diem_Ne_Nep_KTX_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="scoring-container">
      {/* HEADER */}
      <div className="scoring-header">
        <div className="header-title-wrapper">
          <h2>
            <ClipboardCheck color="#2563eb" size={24} /> Chấm Điểm Nề Nếp Theo Phòng
            {loading && <RefreshCw size={16} className="animate-spin" color="#2563eb" />}
          </h2>
          <p>Điểm khởi tạo ban đầu: 10 điểm</p>
        </div>

        <div className="header-actions">
          <button onClick={handleExportExcel} className="btn-export" title="Xuất file Excel chia theo từng phòng">
            <FileSpreadsheet size={16} /> Xuất Excel
          </button>

          <div className="search-box">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Tìm tên / MSV..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
        </div>
      </div>

      {/* DANH SÁCH TAB PHÒNG */}
      <div className="room-tabs-container">
        {roomList.map((roomName) => {
          const isActive = selectedRoom === roomName;
          return (
            <button
              key={roomName}
              onClick={() => setSelectedRoom(roomName)}
              className={`room-tab-btn ${isActive ? 'active' : ''}`}
            >
              <DoorClosed size={14} />
              {roomName}
              <span className="room-badge">{roomCounts[roomName] || 0}</span>
            </button>
          );
        })}
      </div>

      <div className="main-layout">
        {/* BẢNG CHẤM ĐIỂM */}
        <div className="table-card">
          <div className="table-responsive-wrapper">
            <table className="scoring-table">
              <thead>
                <tr>
                  <th className="col-stt">STT</th>
                  <th className="col-msv">MSV</th>
                  <th className="col-name">HỌ VÀ TÊN</th>
                  <th className="col-room">Phòng</th>
                  <th className="th-score">Điểm nề nếp</th>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((day) => (
                    <th key={day} className="col-day">{day}</th>
                  ))}
                  <th className="col-note">Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={16} style={{ padding: '24px', color: '#94a3b8' }}>
                      Không có sinh viên nào trong danh sách
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((st, idx) => {
                    const studentKey = String(st.studentId || st.id || idx);
                    const finalScore = calculateFinalScore(studentKey);

                    return (
                      <tr key={`${studentKey}-${idx}`}>
                        <td>{idx + 1}</td>
                        <td className="col-msv">{st.studentId || st.id}</td>
                        <td className="col-name">{st.name}</td>
                        <td className="col-room">{st.room}</td>

                        {/* ĐIỂM TỔNG */}
                        <td className={`col-total-score ${finalScore < 10 ? 'score-bad' : 'score-good'}`}>
                          {finalScore}
                        </td>

                        {/* 10 NGÀY CHẤM ĐIỂM */}
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((day) => {
                          const dayViolations = scores[studentKey]?.[day] || [];
                          return (
                            <td key={day} style={{ padding: '2px' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center' }}>
                                {dayViolations.map((v, i) => (
                                  <span
                                    key={i}
                                    title={`Trừ ${v.penalty} điểm. Click để xóa`}
                                    className="violation-tag"
                                    onClick={() => handleToggleViolation(st, day, v.code, v.displayCode, v.penalty)}
                                  >
                                    {v.displayCode}
                                  </span>
                                ))}

                                <select
                                  onChange={(e) => handleSelectChange(st, day, e.target.value, e.target)}
                                  className="violation-select"
                                >
                                  <option value="">+</option>
                                  {violations.map((v) => (
                                    <option key={v.code} value={v.code}>
                                      {v.code} (-{v.penalty}đ)
                                    </option>
                                  ))}
                                  {/* Tùy chọn thêm mới trực tiếp bên trong */}
                                  <option value="ADD_CUSTOM" style={{ fontWeight: 'bold', color: '#2563eb' }}>
                                    ➕ Thêm lỗi...
                                  </option>
                                </select>
                              </div>
                            </td>
                          );
                        })}

                        {/* GHI CHÚ */}
                        <td>
                          <input
                            type="text"
                            defaultValue={notes[studentKey] || ''}
                            onBlur={(e) => handleNoteBlur(st, e.target.value)}
                            placeholder="..."
                            className="note-input"
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* CỘT QUY ĐỊNH TRỪ ĐIỂM BÊN PHẢI */}
        <div className="rules-card">
          <h3 className="rules-title">
            <ShieldAlert size={18} color="#dc2626" /> Quy Định Trừ Điểm
          </h3>
          <div className="rules-content">
            <div className="rule-group">
              <strong>1. Điểm danh</strong>
              <div>• Không phép (<b>V</b>): -2 điểm<br />• Có phép (<b>P</b>): -1 điểm</div>
            </div>
            <div className="rule-group">
              <strong>2. Thể dục</strong>
              <div>• Không phép (<b>K</b>): -2 điểm<br />• Có phép (<b>P</b>): -1 điểm</div>
            </div>
            <div className="rule-group">
              <strong>3. Gác đêm</strong>
              <div>• Không phép (<b>D</b>): -2 điểm<br />• Có phép (<b>P</b>): -1 điểm</div>
            </div>
            <div className="rule-group">
              <strong>4. Nội vụ</strong>
              <div>• Không sắp xếp (<b>N</b>): -1 điểm</div>
            </div>

            {/* Các tiêu chí tự chọn phát sinh sẽ tự động liệt kê ở đây */}
            {violations.length > DEFAULT_VIOLATIONS.length && (
              <div className="rule-group" style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '8px', marginTop: '8px' }}>
                <strong>5. Tiêu chí tự chọn khác</strong>
                {violations.slice(DEFAULT_VIOLATIONS.length).map((v) => (
                  <div key={v.code} style={{ marginTop: '4px' }}>
                    • {v.label} (<b>{v.displayCode}</b>): -{v.penalty} điểm
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};