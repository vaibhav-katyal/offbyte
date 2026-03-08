-- ============================================
-- offbyte MYSQL Schema
-- Generated for MySQL Database
-- Auto-generated from detected frontend resources
-- ============================================

-- Drop existing tables (use with caution in production)
DROP TABLE IF EXISTS users;

-- ============================================
-- Table: users
-- Description: Users data
-- ============================================
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255),
    email VARCHAR(255),
    password VARCHAR(255),
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_name ON users(name);

-- ============================================
-- Schema created successfully!
-- ============================================
SELECT 'Schema created successfully!' AS Status;

