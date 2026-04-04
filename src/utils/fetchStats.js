const axios = require('axios');

const enrichProfileWithStats = async (user) => {
    let fullProfile = user.toObject();
    fullProfile.integrations = {};
    const queryParams = {};
    if (user.githubHandle) queryParams.github = user.githubHandle;
    if (user.codeforcesHandle) queryParams.codeforces = user.codeforcesHandle;
    if (Object.keys(queryParams).length > 0) {
        try {
            const response = await axios.get(`${process.env.STATS_SERVICE_URL}/api/stats`, {
                params: queryParams
            });
            fullProfile.integrations = response.data;
        } catch (error) {
            console.error("⚠️ Spring Boot microservice error:", error.message);
        }
    }
    return fullProfile;
};

module.exports = { enrichProfileWithStats };