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
import cors from 'cors';

dotenv.config();

const app: Application = express();
const port = process.env.PORT || 3000;

import { startCrons } from './cron';

DBConnect().then(() => {

  app.use(cors());
  app.use(express.json());

  app.use(express.urlencoded({ extended: true }));

  app.get('/', (res: Response) => {
    res.send('<html><body><h1>Welcome to Finwise</h1><p>and no... our docs are definitely not on <a href="http://localhost:3000/docs">http://localhost:3000/docs</a></p></body></html>');
  });

  app.use('/api/auth', authRoutes);

  // Add deposit routes
  app.use('/api/deposit', depositRoutes);

  // Add withdrawal routes
  app.use('/api/withdrawal', withdrawalRoutes);

  // Add transaction history routes
  app.use('/api/transactions', transactionRoutes);

  // Add transfer routes
  app.use('/api/transfer', transferRoutes);

  // Add admin routes
  app.use('/api/admin', adminRoutes);

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