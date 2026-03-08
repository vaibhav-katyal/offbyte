-- ============================================
-- offbyte MYSQL CRUD Operations
-- All Create, Read, Update, Delete Queries
-- Ready to use in your application
-- ============================================

-- ============================================
-- USERS - CRUD Operations
-- ============================================

-- CREATE: Insert new users
INSERT INTO users (name, email, password)
VALUES ('Sample name', 'user@example.com', 'Sample password');

-- READ: Get all users
SELECT * FROM users ORDER BY createdAt DESC;

-- READ: Get users by ID
SELECT * FROM users WHERE id = 1;

-- READ: Search users by name
SELECT * FROM users WHERE name LIKE '%search%' ORDER BY name;

-- UPDATE: Update users
UPDATE users
SET name = 'Sample name', email = 'user@example.com'
WHERE id = 1;

-- DELETE: Delete users
DELETE FROM users WHERE id = 1;


