const express = require("express");
const cors = require("cors");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
app = express();

app.use(cors());
app.use(express.json());

const dbPath = path.join(__dirname, "userdata.db");
let db = null;

const startServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3001, () => {
      console.log("Server Running at http://localhost:3001/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

startServer();

const authenticateToken = async (request, response, next) => {
  let token;
  const authorizationHeader = request.headers["authorization"];
  if (authorizationHeader !== undefined) {
    token = authorizationHeader.split(" ")[1];
  }
  if (token === undefined) {
    response.status(401);
    response.json({ error: "Invalid Token" });
  } else {
    jwt.verify(token, "SECRET_TOKEN", (error, payload) => {
      if (error) {
        response.json({ message: "Invalid Token this is after getting token" });
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

//API for registering the user into database
app.post("/users/", async (request, response) => {
  const { username, password, email } = request.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const selectUserQuery = `SELECT * FROM users WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    const createUser = `
        INSERT INTO 
          users (username, password, email) 
        VALUES 
          (
            '${username}', 
            '${hashedPassword}', 
            '${email}'
          );`;
    const dbResponse = await db.run(createUser);
    const newUserId = dbResponse.lastID;
    response.json({ message: `Created new user ${newUserId}` });
  } else {
    response.status = 400;
    response.json({ message: "User already exists" });
  }
});

//API for logging the user into the database
app.post("/login", async (request, response) => {
  const { username, password } = request.body;
  const selectUser = `SELECT * FROM users WHERE username = '${username}'`;
  const dbUser = await db.get(selectUser);
  if (dbUser === undefined) {
    response.status(400);
    //response.send("Invalid User");
    response.json({ message: "Invalid User" });
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "SECRET_TOKEN");
      //console.log(jwtToken);
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.json({ message: "Invalid Password" });
    }
  }
});

app.get("/profile", authenticateToken, async (request, response) => {
  const { username } = request.username;
  const selectUserQuery = `SELECT * FROM users WHERE username = ${username}`;
  const getUserData = db.get(selectUserQuery);
  if (getUserData === undefined) {
    response.status(400);
    response.json({ message: "Invalid User" });
  } else {
    response.status(200);
    response.send(getUserData);
  }
});
