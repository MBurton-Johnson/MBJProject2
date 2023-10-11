import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
// import { Octokit } from "octokit";
import mongoose from "mongoose";
import 'dotenv/config';

const app = express()
app.use(cors())
app.use(bodyParser.json())
app.use(express.json());

// Set port to listening

const port = process.env.PORT || 4000

app.listen(port, () => {
    console.log(`listening on port: ${port}`);
})


// Connecting to MongoDB
mongoose.connect(process.env.DATABASE_URL, {useNewUrlParser: true, useUnifiedTopology: true})
  .then(() => console.log('Connected to MongoDB'))
  .catch((error) => console.error('Could not connect to MongoDB', error));


// Creating my User Model
const userSchema = new mongoose.Schema({
    userEmail: {
        type: String,
        required: true
    },
    lastLogin: {
        type: Date,
        require: true
    },
    podcasts: {
        type: [String], // UUIDs of podcasts
        required: false
      }
  })

  const User = mongoose.model('User', userSchema)

// Creating podcast scheme

const podcastSchema = new mongoose.Schema({
    uuid: {
      type: String,
      required: true,
      unique: true
    },
    name: {
      type: String,
      required: true
    },
    description: {
      type: String,
      required: true
    },
    imageUrl: {
      type: String,
      required: true
    }
  });
  
  const Podcast = mongoose.model('Podcast', podcastSchema);
  
// Login request

app.post('/user/login', async (req, res) => {
    console.log("Received:", req.body);
    console.log('Request body:', req.body);
    
    try {
        if (await User.count({"userEmail": req.body.email}) === 0) {
            const newUser = new User({
                userEmail: req.body.email, 
                lastLogin: new Date()  // Ensure this is a date object
            });
            await newUser.save();
            res.json({ message: 'User created successfully' });
        } else {
            await User.findOneAndUpdate(
                {"userEmail": req.body.email}, 
                {lastLogin: new Date()}
            );
            res.json({ message: 'User updated successfully' });
        }
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

  // Add podcast to a user's database / model
  
  app.post('/user/addPodcast', async (req, res) => {
    console.log('Add Podcast to user model 2');
    
    const { userEmail, podcastUuid } = req.body;

    console.log('podcastUuid:', podcastUuid, 'Type:', typeof podcastUuid);

    if (typeof podcastUuid !== 'string') {
        console.error('Invalid podcastUuid:', podcastUuid);
        return res.status(400).json({ message: 'Invalid podcastUuid format' });
    }

    try {
      await User.findOneAndUpdate(
          { userEmail },
          { $addToSet: { podcasts: podcastUuid } }
      );
      res.json({ message: 'Podcast added to user library' });
  } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Add new podcast data to MongoDB
app.post('/podcast/add', async (req, res) => {
    console.log('Add Podcast to DB');
    const { uuid, name, description, imageUrl } = req.body;
    
    try {
      const newPodcast = new Podcast({
        uuid,
        name,
        description,
        imageUrl
      });
      await newPodcast.save();
      res.json({ message: 'Podcast added successfully', data: newPodcast });
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ message: 'Internal Server Error' });
    }
  });

// Post User podcast data to their user page

app.post('/user/podcasts', async (req, res) => {
    try {
      const { userEmail } = req.body;
      const user = await User.findOne({ userEmail });

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
  
      if (!Array.isArray(user.podcasts) || user.podcasts.some(uuid => typeof uuid !== 'string')) {
        console.error('Invalid data in user.podcasts:', user.podcasts);
        return res.status(400).json({ message: 'User data is in invalid format' });
    }

      // Fetch podcast details based on uuids stored in user.podcasts
      const podcasts = await Podcast.find({ uuid: { $in: user.podcasts } });
      res.json({ podcasts });
    } catch (error) {
      console.error('Error fetching user podcasts:', error);
      res.status(500).json({ message: 'Internal Server Error' });
    }
  });

  