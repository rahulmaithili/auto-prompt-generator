import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { AIService } from './services/aiService.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for Chrome Extension requests
app.use(cors());

// Parse JSON request bodies
app.use(express.json());

// Initialize AI Service
const aiService = new AIService();

/**
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

/**
 * Endpoint to improve user prompt
 */
app.post('/api/improve', async (req, res) => {
  const { prompt, tone } = req.body;

  if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
    return res.status(400).json({
      error: 'Invalid request: "prompt" string is required.'
    });
  }

  // Validate tone
  const validTones = ['simple', 'advanced', 'expert'];
  const selectedTone = validTones.includes(tone) ? tone : 'advanced';

  try {
    const result = await aiService.improvePrompt(prompt, selectedTone);
    return res.json(result);
  } catch (error) {
    console.error('API Error:', error.message);
    return res.status(500).json({
      error: 'Failed to optimize prompt. Please check server logs.',
      message: error.message
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});

app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`🚀 Auto Prompt Generator Backend running on:`);
  console.log(`   👉 http://localhost:${PORT}`);
  console.log(`==================================================`);
});

export default app;
