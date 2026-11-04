const PUBLIC_FIELDS = ['_id', 'firstName', 'lastName', 'gender', 'photoUrl', 'age', 'about', 'skills'];
const PAGE_SIZE = 20;

function createDeveloperSearchHandler(User) {
    return async (req, res) => {
        const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
        const pageValue = req.query.page === undefined ? '1' : req.query.page;
        if (query.length < 2 || query.length > 80) {
            return res.status(400).json({ message: 'Enter between 2 and 80 characters to search.' });
        }
        if (typeof pageValue !== 'string' || !/^\d+$/.test(pageValue) || Number(pageValue) < 1 || Number(pageValue) > 1000) {
            return res.status(400).json({ message: 'Invalid search page.' });
        }
        const page = Number(pageValue);
        // Treat punctuation literally, never as a user-supplied regular expression.
        const prefix = new RegExp('^' + query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        try {
            const matches = await User.find({
                _id: { $ne: req.user._id },
                $or: [{ firstName: prefix }, { lastName: prefix }],
            }).select(PUBLIC_FIELDS.join(' ')).sort({ firstName: 1, lastName: 1, _id: 1 })
                .skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE + 1).lean();
            const users = matches.slice(0, PAGE_SIZE).map(user => Object.fromEntries(
                PUBLIC_FIELDS.filter(key => user[key] !== undefined).map(key => [key, user[key]])
            ));
            return res.json({ users, page, hasMore: matches.length > PAGE_SIZE });
        } catch {
            return res.status(500).json({ message: 'Could not search developers. Please try again.' });
        }
    };
}

module.exports = { createDeveloperSearchHandler };
