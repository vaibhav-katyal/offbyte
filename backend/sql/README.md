# SQL Files for MYSQL

## Files Generated

- **01_schema.sql** - Database schema with CREATE TABLE statements
- **02_crud_operations.sql** - All CRUD operation queries
- **03_relationships_joins.sql** - JOIN queries for relationships
- **04_seed_data.sql** - Sample data for testing

## How to Use

### MySQL
```bash
mysql -u root -p database_name < sql/01_schema.sql
mysql -u root -p database_name < sql/04_seed_data.sql
```

### PostgreSQL
```bash
psql -U postgres -d database_name -f sql/01_schema.sql
psql -U postgres -d database_name -f sql/04_seed_data.sql
```

### SQLite
```bash
sqlite3 database.db < sql/01_schema.sql
sqlite3 database.db < sql/04_seed_data.sql
```

## Execute in Order

1. First run `01_schema.sql` to create tables
2. Then run `04_seed_data.sql` to insert sample data
3. Use `02_crud_operations.sql` as query reference
4. Use `03_relationships_joins.sql` for complex queries
