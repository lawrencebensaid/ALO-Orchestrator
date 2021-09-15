import moment from "moment";
import { MongoClient } from "mongodb";
import WindesheimAzure, { fetchPersonalCookie } from "../foundation/WindesheimAzure";
import fetchGrades from "../fetchGrades";


/**
 * @author Lawrence Bensaid <lawrencebensaid@icloud.com>
 */
class GradeController {

  /**
   * @description Responds personal grades list.
   */
  async myIndex({ session }, resolve, reject) {
    try {
      const { username, password } = session;
      const db = await MongoClient.connect(environment.getDatabaseURI(), { useNewUrlParser: true, useUnifiedTopology: true });
      const dbo = db.db(environment.dbmsName);
      const cookie = await fetchPersonalCookie(username, password);
      const grades = await new WindesheimAzure(cookie).fetchPersonsStudyCourseTestResults(username);
      const courseIDs = [];

      for (const index in grades) {
        const row = grades[index];
        const course = row.course;
        const courseObject = {
          course_code: course.abbr,
          course_name: course.name,
          course_points: course.ects,
          course_description: course.description,
          study_isat: row.WH_study.isatcode
        };

        await dbo.collection("courses").updateOne({ course_code: course.abbr }, {
          $set: courseObject
        }, { upsert: true });
        await dbo.collection("courses").findOne({ course_code: course.abbr });
        if (!courseIDs.includes(course.abbr)) {
          courseIDs.push(course.abbr);
        }

        grades[index] = {
          code: row.id,
          grade: parseFloat(row.grade) || row.grade || null,
          description: row.description,
          courseName: course.name,
          courseCode: course.abbr,
          studyName: row.WH_study.description,
          points: course.ects,
          result: row.result || null,
          passed: row.passed,
          hasresult: row.WH_hasresult,
          isFinal: row.WH_final,
          isValid: row.WH_currentsituation,
          period: row.WH_period.name,
          testdate: Math.floor(moment(row.testdate).valueOf() / 1000),
          modifiedAt: Math.floor(moment(row.lastmodified).valueOf() / 1000),
          modifiedBy: row.WH_modifiedBy.id || null,
        }
      }

      await dbo.collection("users").updateOne({ user_code: username }, { $set: { courses: courseIDs } });
      db.close();

      resolve(grades);
    } catch (error) {
      console.log(error);
      reject({ message: "Failed to fetch Grades" });
    }
  }

}


export default GradeController;