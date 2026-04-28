const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'mock-api-key-for-dev');
const defaultModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const visionModelName = process.env.GEMINI_VLM_MODEL || defaultModel;
const textModelName = process.env.GEMINI_LLM_MODEL || defaultModel;

const vlmModel = genAI.getGenerativeModel({ model: visionModelName });
const llmModel = genAI.getGenerativeModel({ model: textModelName });

module.exports = { genAI, vlmModel, llmModel };
