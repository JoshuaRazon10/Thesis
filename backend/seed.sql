USE sams_db;

-- Clear any existing records
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE tbl_attendance_logs;
TRUNCATE TABLE tbl_students;
TRUNCATE TABLE tbl_teachers;
SET FOREIGN_KEY_CHECKS = 1;

-- Insert students
INSERT INTO tbl_students (student_id, first_name, last_name, section, grade_level) VALUES
(1, 'John', 'Doe', 'Alpha', 'Grade 10'),
(2, 'Jane', 'Smith', 'Alpha', 'Grade 10'),
(3, 'Alice', 'Johnson', 'Beta', 'Grade 11'),
(4, 'Bob', 'Williams', 'Gamma', 'Grade 12');

-- Insert teachers
INSERT INTO tbl_teachers (teacher_id, first_name, last_name, subject) VALUES
(1, 'Charles', 'Xavier', 'Philosophy'),
(2, 'Jean', 'Grey', 'Physics'),
(3, 'Logan', 'Howlett', 'History'),
(4, 'Ororo', 'Munroe', 'Meteorology');

-- Insert attendance logs (currently inside, so departure_time is NULL)
-- Use today's date for date_recorded
INSERT INTO tbl_attendance_logs (student_id, arrival_time, departure_time, date_recorded, log_type) VALUES
(1, '07:30:00', NULL, CURDATE(), 'student'),
(2, '07:45:00', NULL, CURDATE(), 'student'),
(3, '08:00:00', NULL, CURDATE(), 'student'),
(4, '08:15:00', NULL, CURDATE(), 'student');

INSERT INTO tbl_attendance_logs (teacher_id, arrival_time, departure_time, date_recorded, log_type) VALUES
(1, '07:00:00', NULL, CURDATE(), 'teacher'),
(2, '07:15:00', NULL, CURDATE(), 'teacher'),
(3, '07:30:00', NULL, CURDATE(), 'teacher'),
(4, '07:45:00', NULL, CURDATE(), 'teacher');
