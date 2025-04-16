const express = require('express');
const { Groq } = require('groq-sdk');
const router = express.Router();

// Initialize Groq client
const groqClient = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

/**
 * Handle First Aid emergency assistance
 */
router.post('/first-aid', async (req, res) => {
  try {
    const { emergency } = req.body;
    
    if (!emergency) {
      return res.status(400).json({ error: 'Emergency description is required' });
    }

    const prompt = `You are an emergency medical assistant providing first aid guidance. 
      Provide clear, step-by-step first aid instructions for this emergency situation: ${emergency}. 
      Keep instructions concise and focused on immediate actions that can be taken before medical help arrives.`;

    const chatCompletion = await groqClient.chat.completions.create({
      messages: [
        { role: "system", content: "You are a medical first aid assistant that provides clear, accurate emergency guidance." },
        { role: "user", content: prompt }
      ],
      model: "llama4-8b",
      temperature: 0.5,
      max_tokens: 1024,
    });

    res.json({ response: chatCompletion.choices[0].message.content });
  } catch (error) {
    console.error('First Aid AI Error:', error);
    res.status(500).json({ error: 'Error processing first aid request' });
  }
});

/**
 * Handle Disease Symptoms analysis
 */
router.post('/symptoms', async (req, res) => {
  try {
    const { symptoms } = req.body;
    
    if (!symptoms) {
      return res.status(400).json({ error: 'Symptoms description is required' });
    }

    const prompt = `I'm experiencing the following symptoms: ${symptoms}. 
      What might these symptoms indicate? Please provide possible conditions, when I should see a doctor, 
      and any home care recommendations. Always include a disclaimer that this is not a diagnosis.`;

    const chatCompletion = await groqClient.chat.completions.create({
      messages: [
        { role: "system", content: "You are a medical assistant providing general health information. You're not diagnosing patients, and you should always recommend consulting a doctor for proper diagnosis." },
        { role: "user", content: prompt }
      ],
      model: "llama4-8b",
      temperature: 0.5,
      max_tokens: 1024,
    });

    res.json({ response: chatCompletion.choices[0].message.content });
  } catch (error) {
    console.error('Symptoms AI Error:', error);
    res.status(500).json({ error: 'Error processing symptoms request' });
  }
});

/**
 * Handle Health Report interpretations
 */
router.post('/report', async (req, res) => {
  try {
    const { report } = req.body;
    
    if (!report) {
      return res.status(400).json({ error: 'Medical report content is required' });
    }

    const prompt = `Please explain the following medical report terms in simple language: ${report}. 
      Break down any medical jargon and explain what each measurement or finding means in everyday terms.`;

    const chatCompletion = await groqClient.chat.completions.create({
      messages: [
        { role: "system", content: "You are a medical assistant that explains medical reports in simple terms." },
        { role: "user", content: prompt }
      ],
      model: "llama4-8b",
      temperature: 0.5,
      max_tokens: 1024,
    });

    res.json({ response: chatCompletion.choices[0].message.content });
  } catch (error) {
    console.error('Report AI Error:', error);
    res.status(500).json({ error: 'Error processing report request' });
  }
});

module.exports = router;