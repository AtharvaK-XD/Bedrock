import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import aiRoutes from './routes/ai';
import userRoutes from './routes/user';
import promptRoutes from './routes/prompts';
import traceRoutes from './routes/traces';
import workflowRoutes from './routes/workflows';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security Middlewares
app.use(helmet());
app.use(
  cors({
    origin: ['http://localhost:5173', 'http://localhost:1420', 'tauri://localhost'],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/user', userRoutes);
app.use('/api/prompts', promptRoutes);
app.use('/api/traces', traceRoutes);
app.use('/api/workflows', workflowRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Backend server securely running on http://localhost:${PORT}`);
});
