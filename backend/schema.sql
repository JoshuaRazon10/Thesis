-- Create Database if not exists
CREATE DATABASE IF NOT EXISTS sams_db;
USE sams_db;

-- Table structure for tbl_students
DROP TABLE IF EXISTS tbl_attendance_logs;
DROP TABLE IF EXISTS tbl_students;
CREATE TABLE tbl_students (
  student_id INT AUTO_INCREMENT PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  section VARCHAR(50) NOT NULL,
  grade_level VARCHAR(50) NOT NULL,
  face_encoding TEXT DEFAULT NULL
);

-- Table structure for tbl_teachers
DROP TABLE IF EXISTS tbl_teachers;
CREATE TABLE tbl_teachers (
  teacher_id INT AUTO_INCREMENT PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  subject VARCHAR(100) NOT NULL,
  face_encoding TEXT DEFAULT NULL
);

-- Table structure for tbl_attendance_logs
CREATE TABLE tbl_attendance_logs (
  log_id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT DEFAULT NULL,
  teacher_id INT DEFAULT NULL,
  arrival_time TIME NOT NULL,
  departure_time TIME DEFAULT NULL,
  date_recorded DATE NOT NULL,
  log_type ENUM('student', 'teacher') NOT NULL,
  FOREIGN KEY (student_id) REFERENCES tbl_students(student_id) ON DELETE CASCADE,
  FOREIGN KEY (teacher_id) REFERENCES tbl_teachers(teacher_id) ON DELETE CASCADE
);
