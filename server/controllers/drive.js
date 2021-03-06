const asyncHandler = require('express-async-handler');
const { client, google } = require('./apisetup');
const model = require('../model/users');
const modelDrive = require('../model/drive');

const drive = google.drive({ version: 'v3', auth: client });

const testDrive = asyncHandler(async (req, res) => {
  const driveRes = await drive.files.list({
    pageSize: 20,
    fields: 'nextPageToken, files(id, name,mimeType)',
  });
  res.status(200).json(driveRes);
});

const createRootFolder = asyncHandler(async () => {
  const fileMetadata = {
    name: 'Piece of Mind',
    mimeType: 'application/vnd.google-apps.folder',
  };
  const driveRes = await drive.files.create({
    resource: fileMetadata,
    fields: 'id',
  });

  return driveRes.data.id;
});

const createNote = asyncHandler(async (req, res) => {
  let { userHash, noteName, folderId } = req.body;
  const userDBdata = await model.getUser(userHash);
  if (folderId.includes('.')) {
    folderId = folderId.substring(0, folderId.length - 1);
  }
  const fileMetadata = {
    name: noteName,
    parents: [folderId],
    mimeType: 'application/vnd.google-apps.document',
  };
  if (userDBdata.length === 0) {
    res.status(400).send('User Not Found');
    return;
  }
  const driveRes = await drive.files.create({
    resource: fileMetadata,
    fields: 'id',
  });
  const folderDbData = await modelDrive.getFolder(folderId);
  const dbRes = await modelDrive.createNote(
    userDBdata[0].acc_id,
    driveRes.data.id,
    folderDbData[0].f_id,
    null,
  );
  res.status(200).json(dbRes);
});

const getFolders = asyncHandler(async (req, res) => {
  const userHash = req.params.user;
  const userDBdata = await model.getUser(userHash);
  const rootId = userDBdata[0].root_folder;
  const driveRes = await drive.files.list({
    pageSize: 20,
    fields: 'nextPageToken, files(id, name,mimeType,modifiedTime)',
    q: `'${rootId}' in parents`,
  });
  const dbFolderData = await modelDrive.getAllUserFolders(userDBdata[0].acc_id);
  const filteredData = dbFolderData.filter(el =>
    driveRes.data.files.map(ell => ell.id).includes(el.folder_id),
  );
  res.status(200).json(filteredData);
});

const getNotesFromFolder = asyncHandler(async (req, res) => {
  const folderId = req.params.folderid;
  const driveRes = await drive.files.list({
    pageSize: 20,
    fields: 'nextPageToken, files(id, name,mimeType,description,modifiedTime)',
    q: `'${folderId}' in parents`,
  });
  res.status(200).json(driveRes);
});

const deleteNote = asyncHandler(async (req, res) => {
  const { userHash, noteId } = req.body;
  const userDBdata = await model.getUser(userHash);

  const noteDbData = await modelDrive.getNote(noteId);

  if (noteDbData.length === 0) {
    res.status(404).send('File doesnt exist');
    return;
  }
  if (noteDbData.fk_acc_id !== userDBdata.acc_id) {
    res.status(401).send('This file doesnt belong to you!');
    return;
  }
  await drive.files.delete({
    fileId: noteId,
  });

  const dbRes = await modelDrive.deleteNote(noteId, userDBdata[0].acc_id);

  res.status(200).json(dbRes);
});

const deleteFolder = asyncHandler(async (req, res) => {
  const { userHash, folderId } = req.body;
  const userDBdata = await model.getUser(userHash);

  const folderDbData = await modelDrive.getFolder(folderId);

  if (folderDbData.length === 0) {
    res.status(404).send('Folder doesnt exist');
    return;
  }
  if (folderDbData.fk_acc_id !== userDBdata.acc_id) {
    res.status(401).send('This folder doesnt belong to you!');
    return;
  }
  await drive.files.delete({
    fileId: folderId,
  });

  const dbRes = await modelDrive.deleteFolder(
    folderDbData[0].f_id,
    userDBdata[0].acc_id,
  );

  res.status(200).json(dbRes);
});

const createFolder = asyncHandler(async (req, res) => {
  const { userHash, folderName, teacherName, grade } = req.body;
  const userDBdata = await model.getUser(userHash);
  const rootId = userDBdata[0].root_folder;
  if (folderName === '') {
    res.status(400).send('Folder needs a name');
    return;
  }
  const fileMetadata = {
    name: folderName,
    parents: [rootId],
    mimeType: 'application/vnd.google-apps.folder',
  };
  if (userDBdata.length === 0) {
    res.status(404).send('User Not Found');
    return;
  }
  const driveRes = await drive.files.create({
    resource: fileMetadata,
    fields: 'id',
  });

  const dataBaseRes = await modelDrive.createFolder(
    userDBdata[0].acc_id,
    folderName,
    driveRes.data.id,
    teacherName,
    grade,
  );
  res.status(200).json(dataBaseRes);
});

async function createFolderServerside(folderName, rootId) {
  const fileMetadata = {
    name: folderName,
    parents: [rootId],
    mimeType: 'application/vnd.google-apps.folder',
  };
  const driveRes = await drive.files.create({
    resource: fileMetadata,
    fields: 'id',
  });
  return driveRes;
}
let counter = 0;

async function copyFiles(docId, folderId, userId) {
  const fid = await modelDrive.getFolderFid(folderId);
  if (fid.length > 0) {
    try {
      const tempFolder = fid[0].folder_id;
      const fileMetaData = {
        parents: [tempFolder],
      };
      const driveRes = await drive.files.copy({
        resource: fileMetaData,
        fileId: docId,
        fields: 'id',
      });
      modelDrive.createNote(userId, driveRes.data.id, folderId, docId);
    } catch (ex) {
      counter += 1;
      console.log(ex.message, '||||', counter);
    }
  }
}

async function createNoteServerside(inputBody) {
  const { userHash, noteName, folderId } = inputBody;
  console.log('TEST 3');
  console.log(userHash);

  const userDbData = await model.getUser(userHash);
  const fileMetaData = {
    name: noteName,
    parents: [folderId],
    mimeType: 'application/vnd.google-apps.document',
  };
  if (userDbData.length === 0) {
    return 'No User';
  }
  const driveRes = await drive.files.create({
    resource: fileMetaData,
    fields: 'id',
  });
  const folderDbData = await modelDrive.getFolder(folderId);
  const dbRes = await modelDrive.createNote(
    userDbData[0].acc_id,
    driveRes.data.id,
    folderDbData[0].f_id,
    null,
  );
  return dbRes;
}

module.exports = {
  testDrive,
  createNote,
  getFolders,
  deleteNote,
  deleteFolder,
  createFolder,
  getNotesFromFolder,
  createRootFolder,
  createFolderServerside,
  copyFiles,
  createNoteServerside,
};
