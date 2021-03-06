const express = require('express');
const {
  login,
  logout,
  addSettings,
  getSettings,
} = require('../controllers/users');
const {
  syncClassrooms,
  syncClassroomFiles,
} = require('../controllers/classroom');
const {
  testDrive,
  createNote,
  getFolders,
  deleteNote,
  createFolder,
  getNotesFromFolder,
  deleteFolder,
} = require('../controllers/drive');
const {
  testDocsAPI,
  addNoteText,
  colorCodeDoc,
} = require('../controllers/docs');

const router = express.Router();

router.get('/welcome', (req, res) => res.send('Willkommen bei Piece of Mind!'));
router.post('/login', login);
router.get('/testdrive', testDrive);
router.get('/logout', logout);
router.post('/note', createNote);
router.get('/folder/:user', getFolders);
router.delete('/note', deleteNote);
router.post('/folder', createFolder);
router.delete('/folder', deleteFolder);
router.get('/notes/:folderid', getNotesFromFolder);
router.get('/classrooms/:id', syncClassrooms);
router.get('/classroomfiles/:id', syncClassroomFiles);
router.get('/docs/:id', testDocsAPI);
router.post('/note/ocr', addNoteText);
router.post('/settings', addSettings);
router.get('/settings/:user', getSettings);
router.post('/colorcoding', colorCodeDoc);

module.exports = router;
