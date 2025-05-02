/* eslint-disable no-undef */
const logger = require('../../middlewares/logger');

// Crear un nuevo log
exports.createLog = (req, res) => {
  const { level, message } = req.body;

  if (!level || !message) {
    return res.status(400).json({ error: 'Level and message are required' });
  }

  // Registrar el log
  logger.log({ level, message });
  res.status(201).json({ message: 'Log created successfully' });
};

// Obtener los logs desde el archivo
exports.getLogs = (req, res) => {
  const fs = require('fs');
  const path = require('path');
  const logFilePath = path.join(__dirname, '../logs/combined.log');

  fs.readFile(logFilePath, 'utf8', (err, data) => {
    if (err) {
      return res.status(500).json({ error: 'Error reading log file' });
    }
    res.send(`<pre>${data}</pre>`);
  });
};