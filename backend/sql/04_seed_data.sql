-- ============================================
-- offbyte MYSQL Sample Data
-- Seed data for testing and development
-- ============================================

-- Clear existing data (use with caution!)
SET FOREIGN_KEY_CHECKS = 0;
DELETE FROM users;
SET FOREIGN_KEY_CHECKS = 1;

-- Insert sample users
INSERT INTO users (name, email, password) VALUES
('Sample 1 name', 'user@example.com', 'Sample 1 password'),
('Sample 2 name', 'user@example.com', 'Sample 2 password'),
('Sample 3 name', 'user@example.com', 'Sample 3 password'),
('Sample 4 name', 'user@example.com', 'Sample 4 password'),
('Sample 5 name', 'user@example.com', 'Sample 5 password');


