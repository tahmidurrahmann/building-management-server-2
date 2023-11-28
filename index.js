const express = require('express');
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const cors = require('cors');
const jwt = require("jsonwebtoken")
const port = process.env.PORT | 5000;
const stripe = require("stripe")(process.env.STRIPE_TOKEN);

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

// verifyToken
const verifyToken = async (req, res, next) => {
    if (!req?.headers?.authorization) {
        return res.status(401).send({ message: "unauthorized access" });
    }
    const token = req?.headers?.authorization.split(" ")[1];
    jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
        if (err) {
            return res.status(401).send({ message: "unauthorized access" });
        }
        req.decoded = decoded;
        next();
    })
}

async function run() {
    try {

        const apartmentCollection = client.db("buildMinder").collection("apartments");
        const agreementCollection = client.db("buildMinder").collection("agreements");
        const userCollection = client.db("buildMinder").collection("users");
        const announcementCollection = client.db("buildMinder").collection("announcements");
        const couponCollection = client.db("buildMinder").collection("coupons");
        const paymentCollection = client.db("buildMinder").collection("payments");
        const historyCollection = client.db("buildMinder").collection("histories");


        //adminMiddleware
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            const isAdmin = user.role === "admin";
            if (!isAdmin) {
                return res.status(403).send({ message: "forbidden access" })
            }
            next();
        }

        // checkAdminOrNot
        app.get("/users/admin/:email", verifyToken, async (req, res) => {
            const email = req?.params?.email;
            if (email !== req?.decoded?.email) {
                return res.status(403).send({ message: "forbidden access" });
            }
            const query = { email: email };
            const user = await userCollection.findOne(query);
            const isAdmin = user.role === "admin";
            res.send({ isAdmin });
        })

        //memberMiddleware
        // const verifyMember = async (req, res, next) => {
        //     const email = req.decoded.email;
        //     const query = { email: email };
        //     const user = await userCollection.findOne(query);
        //     const isMember = user?.role === "member";
        //     if (!isMember) {
        //         return res.status(403).send({ message: "forbidden access" });
        //     }
        //     next();
        // }

        // checkMemberOrNot
        app.get("/users/member/:email", verifyToken, async (req, res) => {
            const email = req?.params?.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            const isMember = user?.role === "member";
            res.send({ isMember });
        })

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

        app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
            const result = await userCollection.find().toArray();
            res.send(result);
        })

        app.patch("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    role: "user",
                }
            }
            const result = await userCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })

        app.patch("/makeMemberAndCheck/:id", verifyToken, verifyAdmin, async (req, res) => {
            const id = req?.params?.id;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    status: "checked",
                    date: new Date().toISOString().split('T')[0],
                }
            }
            const result1 = await agreementCollection.updateOne(filter, updatedDoc);
            const findUser = await agreementCollection.findOne(filter);
            const email = findUser?.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            const updateUser = {
                $set: {
                    role: "member"
                }
            }
            const result2 = await userCollection.updateOne(user, updateUser);
            res.send({ result1, result2 });
        })

        app.patch("/rejectAndChecked/:id", verifyToken, verifyAdmin, async (req, res) => {
            const id = req?.params?.id;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    status: "reject",
                }
            }
            const result = await agreementCollection.updateOne(filter, updatedDoc);
            res?.send(result);
        })

        app.post("/agreementInfo", verifyToken, async (req, res) => {
            const data = req.body;
            const result = await agreementCollection.insertOne(data);
            res.send(result);
        })

        app.get("/agreementInfo", verifyToken, async (req, res) => {
            const email = req?.query?.email;
            const query = { email: email };
            const result = await agreementCollection.find(query).toArray();
            res.send(result);
        })

        app.get("/allAgreements", verifyToken, verifyAdmin, async (req, res) => {
            const result = await agreementCollection.find().toArray();
            res.send(result);
        })

        // jwt
        app.post("/jwt", async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN, { expiresIn: "24h" });
            res.send({ token })
        })

        app.post("/announcements", verifyToken, verifyAdmin, async (req, res) => {
            const announcementInfo = req?.body;
            const result = await announcementCollection.insertOne(announcementInfo);
            res.send(result);
        })

        app.get("/announcements", verifyToken, async (req, res) => {
            const result = await announcementCollection.find().toArray();
            res.send(result);
        })

        // addCoupon
        app.post("/couponData", verifyToken, verifyAdmin, async (req, res) => {
            const coupon = req?.body;
            const result = await couponCollection.insertOne(coupon);
            res.send(result);
        })

        app.get("/get-coupon-info", async (req, res) => {
            const result = await couponCollection.find().toArray();
            res.send(result);
        })

        app.delete("/delete-coupon/:id", verifyToken, verifyAdmin, async (req, res) => {
            const id = req?.params?.id;
            const query = { _id: new ObjectId(id) };
            const result = await couponCollection.deleteOne(query);
            res.send(result);
        })

        //payment
        app.post("/paymentDetails", verifyToken, async (req, res) => {
            const paymentInfo = req?.body;
            const result = await paymentCollection.insertOne(paymentInfo);
            res.send(result);
        })

        app.get("/payments", verifyToken, async (req, res) => {
            const email = req?.query?.email;
            const query = { email: email };
            const result = await paymentCollection.find(query).toArray();
            res.send(result);
        })

        // payment
        app.post("/create-payment-intent", async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 100);
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
                payment_method_types: ["card"],
            })
            res.send({
                clientSecret: paymentIntent.client_secret,
            })
        })

        app.post("/show-payment-history", async (req, res) => {
            const paymentInfo = req?.body;
            const result = await historyCollection.insertOne(paymentInfo);
            res.send(result);
        })

        app.get("/show-payment-history", async (req, res) => {
            const email = req?.query?.email;
            const query = { email: email };
            const result = await historyCollection.find(query).toArray();
            res.send(result);
        })

        // totalNumberOfRooms
        app.get("/total-rooms", verifyToken, verifyAdmin, async (req, res) => {
            const count = await apartmentCollection.estimatedDocumentCount();
            res.send({ count });
        })

        //getMemberNumber
        app.get("/member-number", verifyToken, verifyAdmin, async (req, res) => {
            const query = { role: "member" };
            const result = await userCollection.find(query).toArray();
            res.send(result);
        })

        //getUserNumber
        app.get("/user-number", verifyToken, verifyAdmin, async (req, res) => {
            const query = { role: "user" };
            const result = await userCollection.find(query).toArray();
            res.send(result);
        })

        app.get("/available-unavailable", verifyToken, verifyAdmin, async (req, res) => {
            const apartmentTotal = await apartmentCollection.estimatedDocumentCount();
            const bookedTotal = await agreementCollection.estimatedDocumentCount();
            res.send({apartmentTotal, bookedTotal})
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