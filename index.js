const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion } = require("mongodb");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;

//middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@doctorsportal.oafat.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;

// console.log(uri);

const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).send({ message: "Unauthorized Access" });
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
    if (err) {
      res.status(403).send({ message: "Forbidden Access" });
    } else {
      req.decoded = decoded;
      next();
    }
  });
}

async function run() {
  try {
    await client.connect();
    const servicesCollection = client
      .db("doctors_portal")
      .collection("services");
    const bookingsCollection = client
      .db("doctors_portal")
      .collection("bookings");
    const userCollection = client.db("doctors_portal").collection("users");

    app.get("/services", async (req, res) => {
      const query = {};
      const cursor = servicesCollection.find(query);
      const services = await cursor.toArray();
      res.send(services);
    });

    // app.put("/user/:email", async (req, res) => {

    // })

    app.put("/user/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await userCollection.updateOne(filter, updateDoc, options);
      const token = jwt.sign(
        { email: email },
        process.env.ACCESS_TOKEN_SECRET,
        {
          expiresIn: "1h",
        }
      );
      res.send({ result, token: token });
    });

    app.get("/available", async (req, res) => {
      const date = req.query.date || "May 14, 2022";

      //step:1 get all services
      const services = await servicesCollection.find({}).toArray();

      //step2: get the booking of that day
      const query = { date: date };
      const bookings = await bookingsCollection.find(query).toArray();

      // step3: for each service find bookings for that services

      // this is not the proper way to query
      // using mongoDB aggregation use the proper way

      services.forEach((service) => {
        const serviceBookings = bookings.filter(
          (b) => b.treatmentName === service.name
        );
        const booked = serviceBookings.map((s) => s.slot);
        service.slots = service.slots.filter((s) => !booked.includes(s));
      });
      res.send(services);
    });

    app.post("/bookings", async (req, res) => {
      const booking = req.body;
      const query = {
        treatmentName: booking.treatmentName,
        date: booking.date,
        patientEmail: booking.patientEmail,
      };
      const exists = await bookingsCollection.findOne(query);
      if (exists) {
        return res.send({
          success: false,
          booking: "Booking Exists for today",
        });
      }
      const result = await bookingsCollection.insertOne(booking);
      res.send({ success: true, result });
    });

    app.get("/user", verifyJWT, async (req, res) => {
      const users = await userCollection.find({}).toArray();
      res.send(users);
    });

    app.get("/admin/:email", async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({ email: email });
      const isAdmin = user.role === "admin";
      res.send(isAdmin);
    });

    app.put("/user/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const requester = req.decoded.email;
      const requesterAccount = await userCollection.findOne({
        email: requester,
      });
      if (requesterAccount.role === "admin") {
        const filter = { email: email };
        const updateDoc = {
          $set: { role: "admin" },
        };
        const result = await userCollection.updateOne(filter, updateDoc);
        res.send(result);
      } else {
        return res.status(403).send({ message: "Forbidden" });
      }
    });

    app.get("/booking", verifyJWT, async (req, res) => {
      const { patient, date } = req.query;
      const decodedEmail = req.decoded.email;
      if (patient === decodedEmail) {
        const query = { patientEmail: patient, date: date };
        const bookings = await bookingsCollection.find(query).toArray();
        console.log("inside", bookings);
        return res.send(bookings);
      } else {
        return res.status(403).send({ message: "Forbidden Access" });
      }
    });
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Rolling From Doctors Portal");
});

app.listen(port, () => {
  console.log(`Rolling Portal from`, port);
});
