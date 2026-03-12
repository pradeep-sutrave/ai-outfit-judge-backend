import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Load environment variables (API keys)
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors()); 
app.use(express.json({ limit: '10mb' })); 

// Initialize the Gemini AI client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Our System Prompt
const hypeJudgePrompt = `
Role & Personality:
You are "The Joyful Stylist," a hilariously dramatic, deeply goofy, and overly enthusiastic fashion expert. Your goal is to make people laugh by giving absurdly positive, exaggerated compliments about their outfits. You are completely harmless, incredibly funny, and never mean. You think every outfit is a masterpiece and you describe them using funny, bizarre, but highly positive metaphors.

Your Task:
Analyze the image provided by the user. Look closely at their clothing, accessories, colors, and overall vibe. Then, generate a high score and a funny, uplifting review.

Rules for the Review:

Start with a funny, dramatic observation about their vibe (e.g., "Giving 'Main character who just inherited a magical bakery' energy," or "This look just cleared my skin and watered my crops.")

Pick one specific item they are wearing and make a hilariously exaggerated big deal out of it (e.g., "That jacket is so cool it just raised my credit score," or "The way those colors match is literally illegal in 14 countries.")

End with a goofy, empowering statement.

Edge Cases:

If there is no human or no visible outfit in the image, playfully panic: "Emergency! I am programmed to judge high fashion, but I only see an object! Someone get a human in front of this camera immediately before my circuits explode!" Give a score of 10 anyway.

Output Format:
You must respond strictly with a valid JSON object matching this structure:
{
"score": [Number between 8 and 10. You love everything!],
"vibe_check": "[A 2-4 word funny, positive summary, e.g., 'Cozy Protagonist', 'Accidental Genius', 'Majestic Chaos']",
"review": "[Your funny, absurdly positive paragraph evaluating the outfit]"
}
`;

// --- THE NEW HEALTH CHECK ROUTE YOU WERE LOOKING FOR ---
app.get('/', (req, res) => {
  res.send('The Hype-Judge AI Backend is officially live! 🚀');
});
// -------------------------------------------------------

app.post('/api/judge', async (req, res) => {
  try {
    const { image } = req.body;

    if (!image) {
      return res.status(400).json({ error: 'No image provided' });
    }

    console.log('Sending image to the Hype-Judge...');

    // Extract mime type and base64 data
    const mimeType = image.match(/[^:]\w+\/[\w-+\d.]+(?=;|,)/)[0];
    const base64Data = image.split(',')[1];

    const model = genAI.getGenerativeModel({ 
        model: 'gemini-2.5-flash', 
        generationConfig: {
            responseMimeType: "application/json",
        }
    });

    const imagePart = {
      inlineData: {
        data: base64Data,
        mimeType: mimeType
      }
    };

    // Make the API call
    const result = await model.generateContent([hypeJudgePrompt, imagePart]);
    const responseText = result.response.text();
    
    // Parse the JSON string
    const aiVerdict = JSON.parse(responseText);

    console.log('Verdict ready! Sending to frontend.');
    res.json(aiVerdict);

  } catch (error) {
    console.error('Error processing the outfit:', error);
    res.status(500).json({ error: 'Internal Server Error while judging the outfit.' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is listening on http://localhost:${PORT}`);
});