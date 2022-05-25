const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.pvenr.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

// jwt
function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'UnAuthorized access' });
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'Forbidden access' })
        }
        req.decoded = decoded;
        next();
    });
}
// api
async function run() {
    try {
        await client.connect();
        const toolsCollection = client.db('Power_Tools').collection('Tools');
        const usersCollection = client.db('Power_Tools').collection('users');
        const orderCollection = client.db('Power_Tools').collection('orders');
        const reviewCollection = client.db('Power_Tools').collection('reviews');

        // users api
        app.get('/users', async (req, res) => {
            const users = await usersCollection.find().toArray();
            res.send(users);
        });
        // update users
        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
                $set: user,
            };
            const result = await usersCollection.updateOne(filter, updateDoc, options);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
            res.send({ result, token });
        });
        // get all orders api
        app.get('/orders', verifyJWT, async (req, res) => {
            const orders = await orderCollection.find().toArray();
            res.send(orders)
        });
        // order by email
        app.get('/myorders', async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const order = await orderCollection.find(query).toArray();
            res.send(order);
        });
        // delete order
        app.delete('/order/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const result = await orderCollection.deleteOne(filter);
            res.send(result);
        });

        // get all api
        app.get('/tools', verifyJWT, async (req, res) => {
            const tools = await toolsCollection.find().toArray();
            res.send(tools);
        });
        // get by id api
        app.get('/tools/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const purchase = await toolsCollection.findOne(query);
            res.send(purchase);
        });
        // app.put('/tools/:id', async (req, res) => {
        //     const id = req.params.id;

        // })

        app.post('/order', async (req, res) => {
            const order = req.body;
            const query = { productName: order.productName, email: order.email, quantity: order.quantity, totalPrice: order.totalPrice };
            const result = await orderCollection.insertOne(query);
            res.send(result);
        });
        app.post('/review', async (req, res) => {
            const review = req.body;
            const query = { email: review.email, image: review.image, name: review.name, description: review.description, rating: review.rating };
            const result = await reviewCollection.insertOne(query);
            res.send(result);
        });
        app.get('/reviews', verifyJWT, async (req, res) => {
            const reviews = await reviewCollection.find().toArray();
            res.send(reviews);
        });


    }
    finally {

    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Hello World!')
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})