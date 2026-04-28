const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
dotenv.config();

// We are setting up Gmail SMTP.
// To make this work, you must provide your real email and an App Password in your backend/.env file.
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER, // e.g., 'your.email@gmail.com'
    pass: process.env.SMTP_PASS  // e.g., 'abcd1234abcd1234' (Google App Password)
  }
});

module.exports = transporter;
