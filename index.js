const express = require("express");
const cors = require("cors");
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

async function run() {
  try {
    await client.connect();
    const servicesCollection = client
      .db("doctors_portal")
      .collection("services");
    const bookingsCollection = client
      .db("doctors_portal")
      .collection("bookings");

    app.get("/services", async (req, res) => {
      const query = {};
      const cursor = servicesCollection.find(query);
      const services = await cursor.toArray();
      res.send(services);
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
