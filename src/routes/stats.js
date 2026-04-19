const express = require('express');
const axios = require('axios');
const statsRouter = express.Router();
const { userAuth } = require('../middleware/auth'); 

statsRouter.get('/stats', userAuth, async (req, res) => {
    try {
        const { github, codeforces, leetcode, userId } = req.query;
        const queryParams = { userId };
        if (github) queryParams.github = github;
        if (codeforces) queryParams.codeforces = codeforces;
        if (leetcode) queryParams.leetcode = leetcode;
        const SPRING_BACKEND_URL = process.env.STATS_SERVICE_URL || "https://dev-tinder-spring-backend.onrender.com";

        console.log(`[Proxy] Forwarding request to Spring Boot for User: ${userId}`);
        const response = await axios.get(`${SPRING_BACKEND_URL}/api/stats`, {
            params: queryParams,
            timeout: 60000 
        });

        res.json(response.data);
    } catch (error) {
        console.error("⚠️ Stats Proxy Error:", error.message);
        res.status(500).json({ error: "Failed to fetch live stats from microservice" });
    }
});

module.exports = statsRouter;