const asyncHandler = require('express-async-handler');
const { client, google } = require('./apisetup');
const model = require('../model/users');
const modelDrive = require('../model/drive');
const modelClassroom = require('../model/classrooms');

const classroom = google.classroom({ version: 'v1', auth: client });

const synchClassrooms = asyncHandler(async (req, res) => {
  console.log(req);

  const userId = await model.getUser(req.session.userHash);
  const apiRes = (await classroom.courses.list({})).data.courses.map((el) => ({ id: el.id, name: el.name, user_id: user.id }));
  const dbClassrooms = await modelClassroom.getAllClassrooms(userId.acc_id);
  console.log(dbClassrooms);

  res.status(200).json(apiRes.data.courses);
});

module.exports = { synchClassrooms };
