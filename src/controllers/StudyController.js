import { MongoClient } from "mongodb";
import WindesheimAzure, { fetchCookie } from "../foundation/WindesheimAzure";


const STUDY_TYPE = {
  "opleiding": "education",
  "cursus": "course"
}

const STUDY_FORM = {
  "voltijd": "fulltime",
  "deeltijd": "parttime",
  "duaal": "dual",
  "regulier": "regular"
}

/**
 * @author Lawrence Bensaid <lawrencebensaid@icloud.com>
 */
class StudyController {


  /**
   * @description 
   */
  async index({ session }, resolve, reject) {
    try {
      const { username, password } = session;
      const db = await MongoClient.connect(environment.getDatabaseURI(), { useNewUrlParser: true, useUnifiedTopology: true });
      const dbo = db.db(environment.dbmsName);
      if (username && password) {
        try {
          const cookie = await fetchCookie(username, password);
          const studies = await new WindesheimAzure(cookie).fetchOnderwijsproduct();
          for(const index in studies) {
            const study = studies[index];
            const form = STUDY_FORM[study.crohovorm.toLowerCase()] || form;
            const type = STUDY_TYPE[study.onderwijsproducttype.toLowerCase()] || type;
            studies[index] = {
              study_code: study.id,
              study_name: study.crohonaam,
              study_summary: study.onderwijsproductnaam,
              study_type: type,
              study_form: form,
              study_isat: study.isatcode,
            }
          }
          await dbo.collection("studies").insertMany(studies);
        } catch (error) { }
      }

      const studies = await dbo.collection("studies").find().toArray();
      db.close();

      // Format
      for(const index in studies) {
        const study = studies[index];
        studies[index] = {
          code: study.study_code,
          name: study.study_name,
          summary: study.study_summary,
          type: study.study_type,
          form: study.study_form,
          isat: study.study_isat
        }
      }

      resolve(studies);
    } catch (error) {
      console.log(error);
      reject({ message: "Failed to fetch Studies" });
    }
  }


  /**
   * @description 
   */
  async show({ session, params }, resolve, reject) {
    try {
      const { username, password } = session;
      const { id } = params;
      const db = await MongoClient.connect(environment.getDatabaseURI(), { useNewUrlParser: true, useUnifiedTopology: true });
      const dbo = db.db(environment.dbmsName);
      if (username && password) {
        try {
          const cookie = await fetchCookie(username, password);
          const study = await new WindesheimAzure(cookie).fetchOnderwijsproduct(id);
          const form = STUDY_FORM[study.crohovorm.toLowerCase()] || null;
          const type = STUDY_TYPE[study.onderwijsproducttype.toLowerCase()] || null;
          await dbo.collection("studies").insertOne({
            study_code: study.id,
            study_name: study.crohonaam,
            study_summary: study.onderwijsproductnaam,
            study_type: type,
            study_form: form,
            study_isat: study.isatcode,
          });
        } catch (error) { }
      }
      const study = await dbo.collection("studies").findOne({ study_code: id });
      db.close();

      if (!study) {
        reject({ message: `Study '${id}' does not exist` });
        return;
      }

      resolve({
        code: study.study_code,
        name: study.study_name,
        summary: study.study_summary,
        type: study.study_type,
        form: study.study_form,
        isat: study.study_isat
      });
    } catch (error) {
      console.log(error);
      reject({ message: "Failed to fetch Study" });
    }
  }


  /**
   * @description 
   */
  async search({ params }, resolve, reject) {
    try {
      const { query } = params;
      const search = new RegExp(query, "i");
      const db = await MongoClient.connect(environment.getDatabaseURI(), { useNewUrlParser: true, useUnifiedTopology: true });
      const dbo = db.db(environment.dbmsName);
      const studies = await dbo.collection("studies").find({ $or: [{ study_code: { $regex: search } }, { study_name: { $regex: search } }, { study_summary: { $regex: search } }] }).toArray();
      db.close();

      // Format
      studies.forEach((row, i, array) => {
        array[i] = {
          code: row.study_code,
          name: row.study_name,
          summary: row.study_summary,
          type: row.study_type,
          form: row.study_form,
          isat: row.study_isat
        }
      });

      resolve(studies);
    } catch (error) {
      console.log(error);
      reject({ message: "Failed to fetch Studies" });
    }
  }

}


export default StudyController;