import jwt from "jsonwebtoken";
import { MongoClient } from "mongodb";


/**
 * @author Lawrence Bensaid <lawrencebensaid@icloud.com>
 */
class Auth {

  /**
   * @description Required authentication middleware
   */
  async middleware(request, response, next) {
    const authHeader = request.headers["authorization"] || "";
    const isBearer = authHeader.split(" ")[0] === "Bearer";
    const token = authHeader.split(" ")[1];

    if (!isBearer || !token) {
      response.status(401);
      response.json({ message: "Bearer token missing" });
      return;
    }

    try {
      const { data } = jwt.verify(token, environment.secret);
      const { username, password } = data;
      if (typeof username !== "string" || typeof password !== "string") {
        throw new Error("Invalid payload");
      }
      
      const code = username.split("@")[0];
      const now = Math.round(new Date().valueOf() / 1000);

      // Mongo
      const db = await MongoClient.connect(environment.getDatabaseURI(), { useNewUrlParser: true, useUnifiedTopology: true });
      const dbo = db.db(environment.dbmsName);
      const login = await dbo.collection("logins").findOne({ login_token: token, deleted_at: null });
      const user = await dbo.collection("users").findOne({ user_code: code })
      if (user && login) {
        await dbo.collection("logins").updateOne({ login_token: token }, {
          $set: { login_last_seen: now }
        });
        
        db.close();
  
        // Restore session
        request.session.token = token;
        request.session.username = username;
        request.session.password = password;
  
        next();
        
      } else {
        db.close();
        throw new Error("Token no longer valid");
      }
    } catch (error) {
      console.log(error);
      response.status(401);
      response.json({ message: "Token invalid" });
    }
  }

}


export default Auth;