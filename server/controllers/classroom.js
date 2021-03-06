const asyncHandler = require('express-async-handler');
const { client, google } = require('./apisetup');
const model = require('../model/users');
const modelDrive = require('../model/drive');
const modelClassroom = require('../model/classrooms');
const { createFolderServerside, copyFiles } = require('./drive');

const classroom = google.classroom({ version: 'v1', auth: client });

async function getOverallStudentGrade(classroomId) {
  const apiCourseWorkIds = await classroom.courses.courseWork
    .list({
      courseId: classroomId,
    })
    .catch(err => {
      console.log(err.message);
    });
  console.log('START 7');
  if (apiCourseWorkIds === undefined) {
    return {
      grades: [],
      maxPoints: [],
    };
  }
  const filteredRes = apiCourseWorkIds.data.courseWork
    ? apiCourseWorkIds.data.courseWork.map(el => el.id)
    : [];
  const maxPoints = [];
  const userGrades = [];
  console.log('START 6');

  await filteredRes.forEach(async courseWork => {
    const studentSubmissions =
      await classroom.courses.courseWork.studentSubmissions
        .list({
          courseId: classroomId,
          courseWorkId: courseWork,
        })
        .catch(err => {
          console.log(err.message);
          return {
            grades: [],
            maxPoints: [],
          };
        });
    const filteredSubmissions =
      studentSubmissions.data.studentSubmissions.filter(el => el.assignedGrade);
    if (filteredSubmissions.map(el => el.assignedGrade).length > 0) {
      const temp = filteredSubmissions.map(ell => ell.courseWorkId);
      const maxPoint = apiCourseWorkIds.data.courseWork
        .filter(el => temp.includes(el.id))
        .map(el => el.maxPoints);
      userGrades.push(filteredSubmissions.map(el => el.assignedGrade)[0]);
      maxPoints.push(maxPoint);
    }
  });
  return {
    grades: userGrades ? userGrades : [],
    maxPoints: maxPoints ? maxPoints : [],
  };
}

const syncClassrooms = asyncHandler(async (req, res) => {
  console.log('START');

  const userHash = req.params.id;
  const userId = (await model.getUser(userHash))[0];

  const apiRes = await classroom.courses.list({
    courseStates: ['ACTIVE'],
  });
  const mappedRes = apiRes.data.courses.map(el => ({
    id: el.id,
    name: el.name,
    user_id: userId.acc_id,
  }));
  console.log('START 2');

  const dbClassrooms = await modelClassroom.getAllClassrooms(userId.acc_id);
  const mappedDbClassrooms = dbClassrooms.map(el => el.classroom_id);
  mappedRes.forEach(classr => {
    if (!mappedDbClassrooms.includes(classr.id)) {
      modelClassroom.createClassroom(classr.id, classr.name, classr.user_id);
    }
  });
  console.log('START 3');

  const secondDbClassrooms = await modelClassroom.getAllClassrooms(
    userId.acc_id,
  );
  const dbFolderClassrooms = await modelClassroom.getClassroomFolders(
    userId.acc_id,
  );
  const mappedFolderClassrooms = dbFolderClassrooms.map(el => el.classroom_id);
  const filteredSecondDbClassrooms = secondDbClassrooms.filter(
    el => !mappedFolderClassrooms.includes(el.classroom_id),
  );
  if (filteredSecondDbClassrooms.length > 0) {
    filteredSecondDbClassrooms.forEach(async classr => {
      console.log('START 4');

      const teachers = await classroom.courses.teachers
        .list({
          courseId: classr.classroom_id,
        })
        .catch(err => {
          console.log(err.message);
        });
      const { grades, maxPoints } = await getOverallStudentGrade(
        classr.classroom_id,
      ).catch(err => {
        console.log(err.message);
      });

      const teacherName = teachers.data.teachers[0].profile.name.fullName;

      console.log('START 5');

      setTimeout(async () => {
        let sumGrades = 0;
        let sumMaxPoints = 0;
        grades.forEach(el => {
          sumGrades += Number(el);
        });
        maxPoints.forEach(el => {
          sumMaxPoints += Number(el);
        });

        const overallGrade = Math.round((sumGrades / sumMaxPoints) * 100) || 0;

        const apiNewFolder = await createFolderServerside(
          classr.name,
          userId.root_folder,
        );
        const newFolder = await modelDrive.createFolder(
          userId.acc_id,
          classr.name,
          apiNewFolder.data.id,
          teacherName,
          overallGrade,
        );
        const classFolder = await modelClassroom.createClassroomFolder(
          newFolder[0].f_id,
          classr.classroom_id,
          userId.acc_id,
        );
        console.log(classFolder);
        res.status(200).json(mappedRes);
        console.log('END');
      }, 3400);
    });
  } else res.status(200).json({ data: [] });
});

const syncClassroomFiles = asyncHandler(async (req, res) => {
  const userHash = req.params.id;
  const userId = (await model.getUser(userHash))[0];
  // WICHTIG - FALLS CLASSROOM SYNC PER CLASSROOM AUSSCHALTBAR IST, MUSS HIER DAS GANZE ETWAS ANGEPASST WERDEN

  const classRooms = await modelClassroom.getAllClassrooms(userId.acc_id);
  const classroomFolders = await modelClassroom.getClassroomFolders(
    userId.acc_id,
  );

  classRooms.forEach(async classr => {
    const courseWork = await classroom.courses.courseWork
      .list({
        courseId: classr.classroom_id,
      })
      .catch(err => {
        console.log(err.message);
      });
    const unfilteredMaterials = courseWork.data.courseWork
      ? courseWork.data.courseWork.map(el => el.materials).filter(el => el)
      : [];
    const filteredMaterials = [];
    unfilteredMaterials.forEach(material => {
      material.forEach(el => {
        if (el.driveFile) filteredMaterials.push(el.driveFile.driveFile);
      });
    });
    // REMOVE ANYTHING THAT ISNT A PDF OR DOCS
    const substring1 = '.pdf';
    const substring2 = '.docx';
    const filterOnPdfMaterials = filteredMaterials.filter(
      el => el.title.includes(substring1) || el.title.includes(substring2),
    );
    console.log('Classroom: ', classr.name);
    console.log(filteredMaterials);

    let setOff = 0;
    filterOnPdfMaterials.forEach(async pdf => {
      const copyOfDoc = await modelDrive.getCopysOfDocument(pdf.id);

      if (copyOfDoc.length === 0) {
        console.log(pdf.id);
        const folderId = classroomFolders.filter(
          el => el.classroom_id === classr.classroom_id,
        );
        setTimeout(() => {
          copyFiles(pdf.id, folderId[0].f_id, userId.acc_id);
        }, setOff);
        setOff += 200;
      }
    });
  });
  res.status(200).send('Done');
});

module.exports = { syncClassrooms, syncClassroomFiles };
