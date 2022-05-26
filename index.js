const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const stripe = require("stripe")('sk_test_51L1X0aJ4uo6umqFGlX4zF8WfRrJoNPFilrmroV5SP8WZ6r4scj2JQXaRooHcdaClMnQS1G0BBNFEVs03i0XDVB9b00lZesQk98');
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
        const paymentCollection = client.db('Power_Tools').collection('payment');
        const userProfileCollection = client.db('Power_Tools').collection('userProfile');

        // PAYMENTS
        app.post('/create-payment-intent', async (req, res) => {
            const service = req.body;
            const price = service.price;
            const amount = price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });
            res.send({ clientSecret: paymentIntent.client_secret })
        });

        // users api
        app.get('/users', async (req, res) => {
            const users = await usersCollection.find().toArray();
            res.send(users);
        });
        // get specific user 
        app.get('/user/:email', async (req, res) => {
            const email = req.params.email;
            console.log(email)
            const query = { email: email }
            const user = await usersCollection.findOne(query);
            res.send(user);
        })
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
        // my profile
        app.put('/myprofile/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
                $set: user
            }
            const result = await usersCollection.updateOne(filter, updateDoc, options);
            res.send(result);

        });
        // make admin
        app.put('/user/admin/:email', async (req, res) => {
            const email = req.params.email;
            const filter = { email: email };
            const updateDoc = {
                $set: { role: 'admin' }
            }
            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result);
        })
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
        // get my order
        app.get('/myorders/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const myorder = await orderCollection.findOne(query);
            res.send(myorder);

        });
        // payment
        app.patch('/order/:id', async (req, res) => {
            const id = req.params.id;
            const payment = req.body;
            const filter = { _id: ObjectId(id) };
            const updateDoc = {
                $set: {
                    paid: true,
                    transactionId: payment.transactionId,
                }
            }
            const result = await paymentCollection.insertOne(payment);
            const updateOrder = await orderCollection.updateOne(filter, updateDoc);
            res.send(updateOrder)
        })
        // delete order
        app.delete('/order/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const result = await orderCollection.deleteOne(filter);
            res.send(result);
        });

        // get all api
        app.get('/tools', async (req, res) => {
            const tools = await toolsCollection.find().toArray();
            res.send(tools);
        });
        // get by id api
        app.get('/tools/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const purchase = await toolsCollection.findOne(query);
            res.send(purchase);
        });

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
        app.get('/reviews', async (req, res) => {
            const reviews = await reviewCollection.find().toArray();
            res.send(reviews.reverse());
        });
        // add product 
        app.post('/tools', async (req, res) => {
            const tools = req.body;
            const query = { name: tools.name, description: tools.description, availableQuantity: tools.availableQuantity, minimumQuantity: tools.availableQuantity, unitPrice: tools.unitPrice, image: tools.image };
            const result = await toolsCollection.insertOne(query);
            res.send(result);
        })

        // update quantity
        app.put('/tool/:id', async (req, res) => {
            const id = req.body.id;
            const reduceQuantity = req.body.quantity;
            const query = { _id: ObjectId(id) };
            const product = await toolsCollection.findOne(query);
            const updateQuantity = await toolsCollection.updateOne(
                { _id: ObjectId(id) },
                {
                    $set: {
                        "availableQuantity": (parseInt(product.availableQuantity) - parseInt(reduceQuantity))
                    }
                }
            );
            res.send(updateQuantity);
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