// Simple Node.js Backend Server for Social Media API Integration
// This server handles API calls to avoid CORS issues and protects your API keys

const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Environment variables for API credentials
const TWITTER_BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN;
const FACEBOOK_ACCESS_TOKEN = process.env.FACEBOOK_ACCESS_TOKEN;
const FACEBOOK_PAGE_ID = process.env.FACEBOOK_PAGE_ID;
const LINKEDIN_ACCESS_TOKEN = process.env.LINKEDIN_ACCESS_TOKEN;
const LINKEDIN_PROFILE_ID = process.env.LINKEDIN_PROFILE_ID || 'ekure-joseph-17335425a';
const LINKEDIN_PERSON_URN = process.env.LINKEDIN_PERSON_URN || 'urn:li:person:ekure-joseph-17335425a';
const TWITTER_USERNAME = process.env.TWITTER_USERNAME || 'blessedjildo';

// Cache to store API responses
const cache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Helper function to check cache
function getCachedData(key) {
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.data;
    }
    return null;
}

// Helper function to set cache
function setCachedData(key, data) {
    cache.set(key, {
        data: data,
        timestamp: Date.now()
    });
}

// Twitter API endpoint
app.get('/api/twitter', async (req, res) => {
    try {
        // Check cache first
        const cached = getCachedData('twitter');
        if (cached) {
            return res.json(cached);
        }

        const response = await axios.get(
            `https://api.twitter.com/2/users/by/username/${TWITTER_USERNAME}/tweets`,
            {
                headers: {
                    'Authorization': `Bearer ${TWITTER_BEARER_TOKEN}`
                },
                params: {
                    max_results: 5,
                    'tweet.fields': 'created_at,author_id,public_metrics',
                    'user.fields': 'name,username'
                }
            }
        );

        const tweets = response.data.data || [];
        const processedTweets = tweets.map(tweet => ({
            id: tweet.id,
            text: tweet.text,
            created_at: tweet.created_at,
            user: {
                name: 'Blessed Jildo School',
                screen_name: TWITTER_USERNAME
            }
        }));

        setCachedData('twitter', processedTweets);
        res.json(processedTweets);
    } catch (error) {
        console.error('Twitter API Error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to fetch Twitter data' });
    }
});

// Facebook API endpoint
app.get('/api/facebook', async (req, res) => {
    try {
        // Check cache first
        const cached = getCachedData('facebook');
        if (cached) {
            return res.json(cached);
        }

        const response = await axios.get(
            `https://graph.facebook.com/v18.0/${FACEBOOK_PAGE_ID}/feed`,
            {
                params: {
                    access_token: FACEBOOK_ACCESS_TOKEN,
                    fields: 'message,created_time,likes.summary(true),comments.summary(true)',
                    limit: 5
                }
            }
        );

        const posts = response.data.data || [];
        setCachedData('facebook', posts);
        res.json(posts);
    } catch (error) {
        console.error('Facebook API Error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to fetch Facebook data' });
    }
});

// LinkedIn API endpoint
app.get('/api/linkedin', async (req, res) => {
    try {
        // Check cache first
        const cached = getCachedData('linkedin');
        if (cached) {
            return res.json(cached);
        }

        const response = await axios.get(
            'https://api.linkedin.com/v2/shares',
            {
                headers: {
                    'Authorization': `Bearer ${LINKEDIN_ACCESS_TOKEN}`
                },
                params: {
                    q: 'owners',
                    owners: LINKEDIN_PERSON_URN,
                    count: 5
                }
            }
        );

        const posts = response.data.elements || [];
        const processedPosts = posts.map(post => ({
            id: post.id,
            text: post.text?.text || 'LinkedIn post content',
            created: post.createdTime,
            reactions: {
                summary: {
                    total_count: Math.floor(Math.random() * 100) // Placeholder
                }
            }
        }));

        setCachedData('linkedin', processedPosts);
        res.json(processedPosts);
    } catch (error) {
        console.error('LinkedIn API Error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to fetch LinkedIn data' });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
    console.log(`Social Media API Server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`Twitter API: http://localhost:${PORT}/api/twitter`);
    console.log(`Facebook API: http://localhost:${PORT}/api/facebook`);
    console.log(`LinkedIn API: http://localhost:${PORT}/api/linkedin`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('Server shutting down gracefully...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('Server shutting down gracefully...');
    process.exit(0);
});