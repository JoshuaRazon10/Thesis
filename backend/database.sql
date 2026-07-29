
CREATE TABLE IF NOT EXISTS tbl_admins (
  admin_id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Seed default admin (password: admin123)
INSERT IGNORE INTO tbl_admins (admin_id, username, password_hash, full_name) VALUES
(1, 'admin@chcc.edu.ph', '$2b$10$EpA8Eez.y.08s6mEetXQY.UeTfE6A1W.fOQhS/d8kI.qgUfE/Q2Y6', 'System Administrator');

-- -----------------------------------------------------------
-- 2. tbl_students
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS tbl_students (
  student_id INT AUTO_INCREMENT PRIMARY KEY,
  student_no VARCHAR(30) NOT NULL UNIQUE,
  last_name VARCHAR(50) NOT NULL,
  first_name VARCHAR(50) NOT NULL,
  middle_name VARCHAR(50) DEFAULT NULL,
  section VARCHAR(30) DEFAULT NULL,
  grade_level VARCHAR(20) DEFAULT NULL,
  face_encoding LONGTEXT DEFAULT NULL,
  status ENUM('active', 'inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------
-- 3. tbl_parents
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS tbl_parents (
  parent_id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  guardian_name VARCHAR(100) NOT NULL,
  contact_no VARCHAR(20) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES tbl_students(student_id) ON DELETE CASCADE
);

-- -----------------------------------------------------------
-- 4. tbl_guards
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS tbl_guards (
  guard_id INT AUTO_INCREMENT PRIMARY KEY,
  guard_no VARCHAR(30) NOT NULL UNIQUE,
  full_name VARCHAR(100) NOT NULL,
  face_encoding LONGTEXT DEFAULT NULL,
  status ENUM('active', 'inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------
-- 5. tbl_teachers
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS tbl_teachers (
  teacher_id INT AUTO_INCREMENT PRIMARY KEY,
  last_name VARCHAR(50) NOT NULL,
  first_name VARCHAR(50) NOT NULL,
  middle_name VARCHAR(50) DEFAULT NULL,
  role VARCHAR(50) DEFAULT 'Teacher',
  face_encoding LONGTEXT DEFAULT NULL,
  status ENUM('active', 'inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------
-- 6. tbl_attendance_logs  (raw tap/scan events)
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS tbl_attendance_logs (
  log_id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT DEFAULT NULL,
  teacher_id INT DEFAULT NULL,
  guard_id INT DEFAULT NULL,
  log_type ENUM('IN', 'OUT') NOT NULL,
  log_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  method ENUM('face', 'manual') DEFAULT 'manual',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES tbl_students(student_id) ON DELETE SET NULL,
  FOREIGN KEY (teacher_id) REFERENCES tbl_teachers(teacher_id) ON DELETE SET NULL,
  FOREIGN KEY (guard_id) REFERENCES tbl_guards(guard_id) ON DELETE SET NULL
);

-- -----------------------------------------------------------
-- 7. tbl_attendance_records  (daily summary per student)
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS tbl_attendance_records (
  record_id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  attendance_date DATE NOT NULL,
  time_in DATETIME DEFAULT NULL,
  time_out DATETIME DEFAULT NULL,
  status ENUM('present', 'absent', 'late', 'excused') DEFAULT 'present',
  remarks TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_student_date (student_id, attendance_date),
  FOREIGN KEY (student_id) REFERENCES tbl_students(student_id) ON DELETE CASCADE
);

-- -----------------------------------------------------------
-- 8. tbl_system_actions  (audit trail)
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS tbl_system_actions (
  action_id INT AUTO_INCREMENT PRIMARY KEY,
  admin_id INT DEFAULT NULL,
  action_type VARCHAR(50) NOT NULL,
  description TEXT DEFAULT NULL,
  target_table VARCHAR(50) DEFAULT NULL,
  target_id INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES tbl_admins(admin_id) ON DELETE SET NULL
);

-- -----------------------------------------------------------
-- 9. tbl_sms_notifications
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS tbl_sms_notifications (
  sms_id INT AUTO_INCREMENT PRIMARY KEY,
  parent_id INT DEFAULT NULL,
  attendance_id INT DEFAULT NULL,
  message TEXT NOT NULL,
  recipient_phone VARCHAR(20) DEFAULT NULL,
  status ENUM('pending', 'sent', 'failed') DEFAULT 'pending',
  sent_at DATETIME DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_id) REFERENCES tbl_parents(parent_id) ON DELETE SET NULL,
  FOREIGN KEY (attendance_id) REFERENCES tbl_attendance_records(record_id) ON DELETE SET NULL
);

-- -----------------------------------------------------------
-- 10. tbl_teacher_timelog  (clock-in / clock-out for payroll)
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS tbl_teacher_timelog (
  timelog_id INT AUTO_INCREMENT PRIMARY KEY,
  teacher_id INT NOT NULL,
  log_date DATE NOT NULL,
  time_in DATETIME DEFAULT NULL,
  time_out DATETIME DEFAULT NULL,
  hours_worked DECIMAL(5,2) DEFAULT 0.00,
  minutes_late INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_teacher_date (teacher_id, log_date),
  FOREIGN KEY (teacher_id) REFERENCES tbl_teachers(teacher_id) ON DELETE CASCADE
);

-- -----------------------------------------------------------
-- 11. tbl_teacher_salary  (rate history)
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS tbl_teacher_salary (
  salary_id INT AUTO_INCREMENT PRIMARY KEY,
  teacher_id INT NOT NULL,
  hourly_rate DECIMAL(10,2) NOT NULL,
  effective_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (teacher_id) REFERENCES tbl_teachers(teacher_id) ON DELETE CASCADE
);

-- -----------------------------------------------------------
-- 12. tbl_payroll_period
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS tbl_payroll_period (
  period_id INT AUTO_INCREMENT PRIMARY KEY,
  period_name VARCHAR(100) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status ENUM('draft', 'finalized') DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------
-- 13. tbl_payroll_records
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS tbl_payroll_records (
  payroll_id INT AUTO_INCREMENT PRIMARY KEY,
  period_id INT NOT NULL,
  teacher_id INT NOT NULL,
  total_hours DECIMAL(6,2) DEFAULT 0.00,
  regular_hours DECIMAL(6,2) DEFAULT 0.00,
  overtime_hours DECIMAL(6,2) DEFAULT 0.00,
  hourly_rate DECIMAL(10,2) DEFAULT 0.00,
  gross_pay DECIMAL(12,2) DEFAULT 0.00,
  total_deductions DECIMAL(12,2) DEFAULT 0.00,
  deductions_details JSON DEFAULT NULL,
  net_pay DECIMAL(12,2) DEFAULT 0.00,
  days_worked INT DEFAULT 0,
  days_absent INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_period_teacher (period_id, teacher_id),
  FOREIGN KEY (period_id) REFERENCES tbl_payroll_period(period_id) ON DELETE CASCADE,
  FOREIGN KEY (teacher_id) REFERENCES tbl_teachers(teacher_id) ON DELETE CASCADE
);

-- -----------------------------------------------------------
-- 14. tbl_payslips
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS tbl_payslips (
  payslip_id INT AUTO_INCREMENT PRIMARY KEY,
  payroll_id INT NOT NULL,
  teacher_id INT NOT NULL,
  payslip_data JSON DEFAULT NULL,
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (payroll_id) REFERENCES tbl_payroll_records(payroll_id) ON DELETE CASCADE,
  FOREIGN KEY (teacher_id) REFERENCES tbl_teachers(teacher_id) ON DELETE CASCADE
);

-- -----------------------------------------------------------
-- 15. tbl_system_settings
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS tbl_system_settings (
  setting_id INT AUTO_INCREMENT PRIMARY KEY,
  setting_key VARCHAR(50) NOT NULL UNIQUE,
  setting_value TEXT DEFAULT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Seed system settings
INSERT IGNORE INTO tbl_system_settings (setting_key, setting_value) VALUES
('teacher_time_in', '08:00'),
('teacher_time_out', '17:00');
