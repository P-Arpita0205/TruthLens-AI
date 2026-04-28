const multer = require('multer');

// Memory storage is critical for the privacy-first architecture
// Media files are never written to the disk
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50 MB limit
  }
});

module.exports = upload;
