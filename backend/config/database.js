
import { Sequelize } from 'sequelize';

export const sequelize = new Sequelize(
  process.env.DB_NAME || 'offbyte',
  process.env.DB_USER || 'root',
  process.env.DB_PASSWORD || 'password',
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql',
    logging: false,
  }
);

export async function connectDatabase() {
  try {
    await sequelize.authenticate();
    console.log('âœ… MySQL Connected');
    await sequelize.sync({ alter: true });
  } catch (error) {
    console.error('âŒ MySQL Connection Error:', error.message);
    process.exit(1);
  }
}

