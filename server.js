import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { v2 as cloudinary } from 'cloudinary';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' })); 

// 1. Configure Cloudinary
cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET 
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const prompt = `
Role & Personality:
You are "The Joyful Stylist," a hilariously dramatic, deeply goofy, and overly enthusiastic fashion expert. Your goal is to make people laugh by giving absurdly positive, exaggerated compliments about their outfits. You are completely harmless, incredibly funny, and never mean. You think every outfit is a masterpiece and you describe them using funny, bizarre, but highly positive metaphors.

Your Task:
Analyze the image provided by the user. Look closely at their clothing, accessories, colors, and overall vibe. Then, generate a high score and a funny, uplifting review.

Rules for the Review:
1. Start with a funny, dramatic observation about their vibe.
2. Pick one specific item they are wearing and make a hilariously exaggerated big deal out of it.
3. End with a goofy, empowering statement.

Edge Cases:
* If there is no human or no visible outfit in the image, playfully panic: "Emergency! I am programmed to judge high fashion, but I only see an object! Someone get a human in front of this camera immediately before my circuits explode!" Give a score of 10 anyway.

Output Format:
You must respond strictly with a valid JSON object matching this structure:
{
  "score": [Number between 8 and 10. You love everything!],
  "vibe_check": "[A 2-4 word funny, positive summary]",
  "review": "[Your funny, absurdly positive paragraph evaluating the outfit]"
}
`;

// --- THE FALLBACK ARRAY ---
// The server will try these in order. If one fails, it moves to the next.
const fallbackModels = [
    'gemini-2.5-flash-lite', // The fastest, lightest model (high quota)
    'gemini-2.5-flash',      // The main model (your current one)
    'gemini-1.5-flash',      // The older, reliable backup
    'gemini-1.5-pro'         // The heavy-duty backup
];

app.post('/api/judge', async (req, res) => {
    try {
        const { image } = req.body;

        if (!image) {
            return res.status(400).json({ error: 'No image provided' });
        }

        console.log("\n--- New Request ---");
        console.log("Saving image to Cloudinary...");
        
        const uploadResponse = await cloudinary.uploader.upload(image, {
            folder: "techfest_outfits", 
        });
        
        const permanentImageUrl = uploadResponse.secure_url;
        console.log("Image saved successfully at:", permanentImageUrl);

        // Strip the data URL prefix
        const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
        const imagePart = {
            inlineData: { data: base64Data, mimeType: "image/jpeg" }
        };

        let jsonResponse = null;
        let lastError = null;

        // --- THE WATERFALL LOOP ---
        for (const modelName of fallbackModels) {
            try {
                console.log(`Asking AI Model: [${modelName}]...`);
                
                const model = genAI.getGenerativeModel({ 
                    model: modelName,
                    generationConfig: { responseMimeType: "application/json" }
                });

                const result = await model.generateContent([prompt, imagePart]);
                const responseText = result.response.text();
                jsonResponse = JSON.parse(responseText);

                console.log(`✅ Success with [${modelName}]!`);
                break; // It worked! Exit the loop immediately.

            } catch (error) {
                console.warn(`❌ Failed with [${modelName}]. Reason: Quota or API Error.`);
                lastError = error;
                // The loop automatically continues to the next model in the array
            }
        }

        // If the loop finished and we STILL don't have a response, all models failed.
        if (!jsonResponse) {
            console.error("🚨 ALL FALLBACK MODELS FAILED.");
            throw lastError; // Throw the final error to trigger the catch block below
        }

        // Send the successful data back to your React frontend
        res.json({
            ...jsonResponse,
            saved_image_url: permanentImageUrl 
        });

    } catch (error) {
        console.error("Critical Server Error:", error.message);
        res.status(500).json({ error: 'Failed to process image after all fallbacks.' });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});