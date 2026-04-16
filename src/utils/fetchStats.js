const axios = require('axios');

const enrichProfileWithStats = async (user) => {
    let fullProfile = typeof user.toObject === 'function' ? user.toObject() : { ...user };
    
    if (!fullProfile.integrations) {
        fullProfile.integrations = {};
    }

    const queryParams = {};
    const userId = fullProfile._id.toString();

    const githubHandle = Array.isArray(fullProfile.githubHandle) ? fullProfile.githubHandle[0] : fullProfile.githubHandle;
    if (!fullProfile.integrations.github && githubHandle) {
        queryParams.github = githubHandle;
        queryParams.userId = userId; 
    }

    const cfHandle = Array.isArray(fullProfile.codeforcesHandle) ? fullProfile.codeforcesHandle[0] : fullProfile.codeforcesHandle;
    if (!fullProfile.integrations.codeforces && cfHandle) {
        queryParams.codeforces = cfHandle;
        queryParams.userId = userId;
    }

    const lcHandle = Array.isArray(fullProfile.leetcodeHandle) ? fullProfile.leetcodeHandle[0] : fullProfile.leetcodeHandle;
    if (!fullProfile.integrations.leetcode && lcHandle) {
        queryParams.leetcode = lcHandle;
        queryParams.userId = userId;
    }
    
    if (Object.keys(queryParams).length > 1 || (Object.keys(queryParams).length === 1 && !queryParams.userId)) {
        console.log(`[Integration] Missing stats in Mongo for ${fullProfile.firstName}. Waking up Spring Boot...`);
        try {
            const response = await axios.get(`${process.env.STATS_SERVICE_URL}/api/stats`, {
                params: queryParams,
                timeout: 120000
            });

            if (response.data.github) {
                fullProfile.integrations.github = response.data.github;
            }
            if (response.data.codeforces) {
                fullProfile.integrations.codeforces = response.data.codeforces;
            }
            if(response.data.leetcode){
                fullProfile.integrations.leetcode = response.data.leetcode;
            }
        } catch (error) {
            console.error("⚠️ Spring Boot microservice error:", error.message);
        }
    } else {
        console.log(`[Integration] Stats for ${fullProfile.firstName} already in Mongo. Skipping Spring Boot call.`);
    }

    return fullProfile;
};

module.exports = { enrichProfileWithStats };