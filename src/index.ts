import express, { Application, Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';

dotenv.config();

const app: Application = express();
const port = process.env.PORT || 3000;

app.use(express.json());

app.use(express.urlencoded({ extended: true }));

app.get('/', (_, res: Response) => {
  res.send('Welcome to Express & TypeScript Server');
});

app.get('/api/hello', (_: Request, res: Response) => {
  res.json({ message: 'Hello from the API!' });
});

app.use((err: Error, __: Request, res: Response, _: NextFunction) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

app.listen(port, () => {
  console.log(`Server is Fire at http://localhost:${port}`);
});