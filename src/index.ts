/* eslint-disable no-console */
import express, { Application, Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import { DBConnect } from './service/database';
import authRoutes from './routes/auth.routes';
import depositRoutes from './routes/deposit.routes';
import transactionRoutes from './routes/transaction.routes';
import withdrawalRoutes from './routes/withdrawal.routes';
import transferRoutes from './routes/transfer.routes';
import adminRoutes from './routes/admin.routes';
import dashboardRoutes from './routes/dashboard.routes';
import tokenRoutes from './routes/tokenRoutes';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import swaggerDocument from './swagger.json';

dotenv.config();

const app: Application = express();
const port = process.env.PORT || 3000;

import { startCrons } from './cron';

DBConnect().then(() => {

  app.use(cors());
  app.use(express.json());

  app.use(express.urlencoded({ extended: true }));

  app.get('/', (res: Response) => {
    res.send('<html><body><h1>Welcome to Finwise</h1><p>Our API documentation is available at <a href="/api-docs">/api-docs</a></p></body></html>');
  });

  // Swagger UI setup
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

  app.use('/api/auth', authRoutes);

  // Add deposit routes
  app.use('/api/deposit', depositRoutes);

  // Add withdrawal routes
  app.use('/api/withdrawal', withdrawalRoutes);

  // Add transaction history routes
  app.use('/api/transactions', transactionRoutes);

  // Add transfer routes
  app.use('/api/transfer', transferRoutes);

  // Add token routes
  app.use('/api/token', tokenRoutes);

  // Add admin routes
  app.use('/api/admin', adminRoutes);

  // Add dashboard routes
  app.use('/api/dashboard', dashboardRoutes);

  // eslint-disable-next-line no-unused-vars
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
  });

  // Start all cron jobs
  startCrons();

  app.listen(port, () => {
    console.log(`Server is Fire at http://localhost:${port}`);
  });

})