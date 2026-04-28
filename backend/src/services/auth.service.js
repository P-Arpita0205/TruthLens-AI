const transporter = require('../config/nodemailer.config');
const crypto = require('crypto');

// In a real application, OTPs should be stored in Redis with an expiration time.
const otpStore = new Map();
const resetSessionStore = new Map();

class AuthService {
  normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
  }

  validateEmail(email) {
    const normalizedEmail = this.normalizeEmail(email);

    if (!normalizedEmail) {
      return { valid: false, message: 'Email is required' };
    }

    if (normalizedEmail.length > 254) {
      return { valid: false, message: 'Email is too long' };
    }

    if (/\s/.test(normalizedEmail)) {
      return { valid: false, message: 'Email cannot contain spaces' };
    }

    if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+$/i.test(normalizedEmail)) {
      return { valid: false, message: 'Enter a valid email address' };
    }

    const parts = normalizedEmail.split('@');
    if (parts.length !== 2) {
      return { valid: false, message: 'Email must contain one @ symbol' };
    }

    const [localPart, domainPart] = parts;

    if (!localPart || localPart.length > 64) {
      return { valid: false, message: 'Email username is invalid' };
    }

    if (!domainPart || domainPart.length > 253) {
      return { valid: false, message: 'Email domain is invalid' };
    }

    if (localPart.startsWith('.') || localPart.endsWith('.') || localPart.includes('..')) {
      return { valid: false, message: 'Email username is invalid' };
    }

    if (!domainPart.includes('.')) {
      return { valid: false, message: 'Email domain must include a valid extension' };
    }

    if (domainPart.startsWith('.') || domainPart.endsWith('.') || domainPart.includes('..')) {
      return { valid: false, message: 'Email domain is invalid' };
    }

    const domainLabels = domainPart.split('.');
    if (domainLabels.some((label) => !label || label.startsWith('-') || label.endsWith('-'))) {
      return { valid: false, message: 'Email domain is invalid' };
    }

    const topLevelDomain = domainLabels[domainLabels.length - 1];
    if (!/^[a-z]{2,}$/i.test(topLevelDomain)) {
      return { valid: false, message: 'Email domain extension is invalid' };
    }

    return { valid: true, email: normalizedEmail };
  }

  generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  async sendEmailOTP(email, providedOtp) {
    const normalizedEmail = this.normalizeEmail(email);
    const otp = providedOtp || this.generateOTP();
    
    // Store OTP with 15 min expiration
    otpStore.set(normalizedEmail, {
      otp,
      expires: Date.now() + 15 * 60 * 1000
    });

    try {
      console.log(`\n========================================`);
      console.log(`🔐 DEVELOPMENT OTP: ${otp}`);
      console.log(`(Email intended for ${normalizedEmail})`);
      console.log(`========================================\n`);

      await transporter.sendMail({
        from: '"TruthLens AI" <noreply@truthlens.ai>',
        to: normalizedEmail,
        subject: 'Your TruthLens AI Verification Code',
        html: `<h2>Your verification code is: <strong>${otp}</strong></h2><p>This code expires in 15 minutes.</p>`
      });
      return true;
    } catch (error) {
      // Even if mock email fails, we return true for dev flow to continue
      return true;
    }
  }

  verifyOTP(email, code) {
    const normalizedEmail = this.normalizeEmail(email);
    const normalizedCode = String(code || '').trim();
    console.log(`\n=== OTP Verification Debug ===`);
    console.log(`Email: ${normalizedEmail}`);
    console.log(`Code provided: ${normalizedCode} (type: ${typeof normalizedCode})`);
    
    const record = otpStore.get(normalizedEmail);
    console.log(`Record found: ${!!record}`);
    
    if (!record) {
      console.log(`OTP not found in store for email: ${normalizedEmail}`);
      console.log(`Current stored emails: ${Array.from(otpStore.keys())}`);
      return { valid: false, message: 'OTP not found or expired' };
    }
    
    console.log(`Stored OTP: ${record.otp} (type: ${typeof record.otp})`);
    console.log(`Expires at: ${new Date(record.expires)}`);
    console.log(`Current time: ${new Date(Date.now())}`);
    console.log(`Time remaining: ${Math.floor((record.expires - Date.now()) / 1000)} seconds`);
    
    if (Date.now() > record.expires) {
      console.log(`OTP expired for email: ${normalizedEmail}`);
      otpStore.delete(normalizedEmail);
      return { valid: false, message: 'OTP expired' };
    }

    if (record.otp === normalizedCode) {
      console.log(`OTP verification successful for email: ${normalizedEmail}`);
      otpStore.delete(normalizedEmail); // One-time use
      return { valid: true };
    }

    console.log(`OTP mismatch: stored=${record.otp}, provided=${normalizedCode}`);
    console.log(`Strict equality check: ${record.otp === normalizedCode}`);
    console.log(`Loose equality check: ${record.otp == normalizedCode}`);
    
    return { valid: false, message: 'Invalid OTP' };
  }

  createResetSession(email) {
    const normalizedEmail = this.normalizeEmail(email);
    resetSessionStore.set(normalizedEmail, {
      expires: Date.now() + 10 * 60 * 1000
    });
  }

  hasValidResetSession(email) {
    const normalizedEmail = this.normalizeEmail(email);
    const record = resetSessionStore.get(normalizedEmail);
    if (!record) return false;
    if (Date.now() > record.expires) {
      resetSessionStore.delete(normalizedEmail);
      return false;
    }
    return true;
  }

  clearResetSession(email) {
    const normalizedEmail = this.normalizeEmail(email);
    resetSessionStore.delete(normalizedEmail);
  }

  hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
  }

  verifyPassword(password, storedHash) {
    if (!storedHash || !password) return false;
    const [salt, originalHash] = storedHash.split(':');
    if (!salt || !originalHash) return false;
    const computedHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return crypto.timingSafeEqual(Buffer.from(originalHash, 'hex'), Buffer.from(computedHash, 'hex'));
  }
}

module.exports = new AuthService();
