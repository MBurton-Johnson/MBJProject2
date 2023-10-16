import express, {Router} from "express";
import cors from "cors";
import bodyParser from "body-parser";
import mongoose from "mongoose";
import 'dotenv/config';
import serverless from "serverless-http";

const api = express()

api.use(cors())
api.use(bodyParser.json())
api.use(express.json());

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

//Creating a review schema

const reviewSchema = new mongoose.Schema({
  rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5
  },
  description: {
      type: String,
      required: true
  },
  podcastUuid: {
      type: String,
      required: true
  },
  userEmail: {
      type: String,
      required: true
  }
});

const Review = mongoose.model('Review', reviewSchema);


const router = Router();

api.get('/api/homepage', (req, res) => {
    // You can put your logic for handling this GET request here.
    // For example, you can send back a JSON response.
    res.json({ message: 'Homepage data goes here' });
  });

router.post('/user/login', async (req, res) => {
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
  
  router.post('/user/addPodcast', async (req, res) => {
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
router.post('/podcast/add', async (req, res) => {
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

router.post('/user/podcasts', async (req, res) => {
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

// Delete podcast from user library

router.delete('/user/deletePodcast', async (req, res) => {
    const { userEmail, podcastUuid } = req.body;

    if (!userEmail || !podcastUuid) {
        return res.status(400).json({ message: 'User email and podcast UUID required' });
    }

    try {
        await User.findOneAndUpdate(
            { userEmail },
            { $pull: { podcasts: podcastUuid } }
        );
        res.json({ message: 'Podcast removed from user library' });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// Add review to podcast

router.post('/review/add', async (req, res) => {
  console.log('Received Review Data:', req.body);
  const { rating, description, podcastUuid, userEmail } = req.body;

  // Ensure all data is present
  if (!rating || !description || !podcastUuid || !userEmail) {
      return res.status(400).json({ message: 'All fields are required' });
  }

  try {
      // Ensure rating is a number between 1 and 5
      const numericRating = Number(rating);
      if (isNaN(numericRating) || numericRating < 1 || numericRating > 5) {
          return res.status(400).json({ message: 'Invalid rating' });
      }

      // Create the new review
      const newReview = new Review({
          rating: numericRating,
          description,
          podcastUuid,
          userEmail
      });
      await newReview.save();

      // Send back a successful response
      res.json({ message: 'Review added successfully', data: newReview });
  } catch (error) {
      // Log the error and send back a server error response
      console.error('Error:', error);
      res.status(500).json({ message: 'Internal Server Error' });
  }
});


// Get podcast data from MongoDB
router.get('/podcasts/:uuid', async (req, res) => {
  try {
      const podcast = await Podcast.findOne({ uuid: req.params.uuid });
      if (!podcast) {
          return res.status(404).json({ message: 'Podcast not found' });
      }
      res.json(podcast);
  } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Get user reviews for a specific podcast
router.post('/review/user', async (req, res) => {
  try {
      const { podcastUuid, userEmail } = req.body;

      // Validations...

      const review = await Review.findOne({ podcastUuid, userEmail });
      if (!review) {
          return res.status(404).json({ message: 'Review not found' });
      }
      res.json(review);
  } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Delete a review

router.delete('/review/delete', async (req, res) => {
  try {
    const { userEmail, podcastUuid } = req.body;

    // Validate input...
    if (!userEmail || !podcastUuid) {
      return res.status(400).json({ message: 'User email and podcast UUID required' });
    }

    // Delete the review
    const result = await Review.deleteOne({ userEmail, podcastUuid });
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Review not found' });
    }
    
    res.json({ message: 'Review deleted successfully' });

  } catch (error) {
    console.error('Error deleting review:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});


api.use("/api/", router);

export const handler = serverless(api);