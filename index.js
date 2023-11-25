const express = require('express');
const app = express();
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config()
const cors = require('cors');
const port = process.env.PORT | 5000;

app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.glcj3l3.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {

        const apartmentCollection = client.db("buildMinder").collection("apartments");
        const agreementCollection = client.db("buildMinder").collection("agreements");
        const userCollection = client.db("buildMinder").collection("users");

        app.get("/apartments", async (req, res) => {
            const pageStr = req.query?.page;
            const pageNumber = parseInt(pageStr);
            const itemsPerPage = 6;
            const skip = pageNumber * itemsPerPage;
            const result = await apartmentCollection.find().skip(skip).limit(itemsPerPage).toArray();
            const totalApartment = await apartmentCollection.estimatedDocumentCount();
            res.send({ result, totalApartment });
        })

        app.post("/users", async (req, res) => {
            const userInfo = req.body;
            const userEmail = userInfo?.email;
            const query = { email: userEmail };
            const findUser = await userCollection.findOne(query);
            if (findUser) {
                return res.status(400).send({ message: "user exists" })
            }
            else {
                const result = await userCollection.insertOne(userInfo);
                res.send(result);
            }
        })

        app.post("/agreementInfo", async (req, res) => {
            const data = req.body;
            const result = await agreementCollection.insertOne(data);
            res.send(result);
        })

        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {

    }
}
run().catch(console.dir);


app.get("/", (req, res) => {
    res.send("Build Minder is Building")
})

app.listen(port, () => {
    console.log(`Build Minder is building on port ${port}`);
})