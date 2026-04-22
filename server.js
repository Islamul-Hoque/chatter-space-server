const express = require('express')
const cors = require('cors');
const app = express();
require('dotenv').config();

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const port = process.env.PORT || 3000

// middleware
app.use(express.json());
app.use(cors());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.xue6gdd.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // await client.connect();

        // Database and Collection
        const db = client.db('ChatterSpace');
        const userCollection = db.collection('users');
        const postCollection = db.collection('post');
        const chatCollection = db.collection('chats');
        const friendCollection = db.collection('friends');
        const storyCollection = db.collection('stories');

        // User APIs (Register & Login user info )
        app.post('/users', async (req, res) => {
            const user = req.body;
            user.createdAt = new Date();
            const email = user.email;
            const userExists = await userCollection.findOne({ email })

            if (userExists) {
                return res.status(409).send({ message: 'User already exists' })
            }

            const result = await userCollection.insertOne(user);
            res.send(result);
        });

        // All Post APIs (Home page)
        app.get('/latest-post', async (req, res) => {
            const result = await postCollection.find().sort({ createdAt: -1 }).toArray();
            res.send(result);
        });

        // Create new post (Home & Profile page)
        app.post('/add-post', async (req, res) => {
            const post = req.body;
            post.createdAt = new Date();
            const result = await postCollection.insertOne(post);
            res.send(result);
        });

        // Delete post (Home & Profile page)
        app.delete('/post/:id', async (req, res) => {
            const id = req.params.id;
            const result = await postCollection.deleteOne({ _id: new ObjectId(id) });
            res.send(result);
        });

        // Update post content (Home page)
        app.patch('/post/:id', async (req, res) => {
            const id = req.params.id;
            const updatedContent = req.body.content;
            const result = await postCollection.updateOne(
                { _id: new ObjectId(id) },
                { $set: { content: updatedContent } }
            );
            res.send(result);
        });

        // Post Like/Dislike (Home page)
        app.patch('/post/like/:id', async (req, res) => {
            const id = req.params.id;
            const { email } = req.body;
            const post = await postCollection.findOne({ _id: new ObjectId(id) });
            const isLiked = post.liked && post.liked.includes(email);
            const update = isLiked
                ? { $pull: { liked: email }, $inc: { likes: -1 } }
                : { $push: { liked: email }, $inc: { likes: 1 } };
            const result = await postCollection.updateOne({ _id: new ObjectId(id) }, update);
            res.send(result);
        });

        // Get all user (Friend page)
        app.get('/users', async (req, res) => {
            const result = await userCollection.find().toArray();
            res.send(result);
        });

        // Comment on post (Home page & Profile page)
        app.patch('/post/comment/:id', async (req, res) => {
            const id = req.params.id;
            const comment = req.body;
            const result = await postCollection.updateOne(
                { _id: new ObjectId(id) },
                { $push: { comments: comment } }
            );
            res.send(result);
        });


        // Update user profile & cover photo (Profile page) 
        app.patch('/users/:email', async (req, res) => {
            const email = req.params.email;
            const updateFields = req.body;

            const userResult = await userCollection.updateOne(
                { email: email },
                { $set: updateFields }
            );

            let postResult = null;
            if (updateFields.photoURL) {
                postResult = await postCollection.updateMany(
                    { authorEmail: email },
                    { $set: { authorPhoto: updateFields.photoURL } }
                );
            }

            res.send({ userResult, postResult });
        });

        // Get chat messages between two users (Chat page)
        app.get('/chats/:email1/:email2', async (req, res) => {
            const email1 = req.params.email1;
            const email2 = req.params.email2;

            const messages = await chatCollection.find({
                $or: [
                    { sender: email1, receiver: email2 },
                    { sender: email2, receiver: email1 }
                ]
            }).sort({ timestamp: 1 }).toArray();

            res.send(messages);
        });

        // Message sending API (Chat page)
        app.post('/chat', async (req, res) => {
            const message = req.body;
            message.timestamp = new Date();
            const result = await chatCollection.insertOne(message);
            res.send(result);
        });

        // Send friend request (Friend page)
        app.post('/friend-request', async (req, res) => {
            const { requester, recipient } = req.body;
            // Check if already exists
            const existing = await friendCollection.findOne({
                $or: [
                    { requester: requester, recipient: recipient },
                    { requester: recipient, recipient: requester }
                ]
            });

            if (existing) {
                return res.send({ message: 'Request already exists', status: existing.status });
            }

            const result = await friendCollection.insertOne({
                requester,
                recipient,
                status: 'pending',
                createdAt: new Date()
            });
            res.send(result);
        });

        // Accept friend request (Friend page)
        app.patch('/friend-request', async (req, res) => {
            const { requester, recipient } = req.body;
            const result = await friendCollection.updateOne(
                { requester: requester, recipient: recipient, status: 'pending' },
                { $set: { status: 'accepted', updatedAt: new Date() } }
            );
            res.send(result);
        });

        // Get all connected friends for a user (Profile, home & Chat page)
        app.get('/friends/:email', async (req, res) => {
            const email = req.params.email;
            const connections = await friendCollection.find({
                $or: [
                    { requester: email },
                    { recipient: email }
                ]
            }).toArray();
            res.send(connections);
        });

        // Get all stories (Home page)
        app.get('/stories', async (req, res) => {
            const result = await storyCollection.find().sort({ createdAt: -1 }).toArray();
            res.send(result);
        });

        // Add new story (Home page)
        app.post('/story', async (req, res) => {
            const story = req.body;
            story.createdAt = new Date();
            const result = await storyCollection.insertOne(story);
            res.send(result);
        });

        // Delete story (Home page)
        app.delete('/story/:id', async (req, res) => {
            const id = req.params.id;
            const result = await storyCollection.deleteOne({ _id: new ObjectId(id) });
            res.send(result);
        });

        // await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // await client.close();
    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Chatter Space server is running!')
})

app.listen(port, () => {
    console.log(`Chatter Space listening on port ${port}`)
})