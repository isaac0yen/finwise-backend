import express, { Application, Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import { DBConnect } from './service/database';
import authRoutes from './routes/auth.routes';

dotenv.config();

const app: Application = express();
const port = process.env.PORT || 3000;

DBConnect().then(() => {

  app.use(express.json());

  app.use(express.urlencoded({ extended: true }));

  app.get('/', (_, res: Response) => {
    res.send('<html><body><h1>Welcome to Finwise</h1><p>and no... our docs are definitely not on <a href="http://localhost:3000/docs">http://localhost:3000/docs</a></p></body></html>');
  });

  app.use('/api', authRoutes);

  app.use((err: Error, __: Request, res: Response, _: NextFunction) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
  });

  app.listen(port, () => {
    console.log(`Server is Fire at http://localhost:${port}`);
  });

})