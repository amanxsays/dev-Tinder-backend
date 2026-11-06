function chatWindow(messages, after, limit = 300, before) {
    if (after && !/^[a-f0-9]{24}$/i.test(after)) throw new Error('Invalid chat cursor');
    const all = Array.isArray(messages) ? messages : [];
    if (before) {
        if (after || !/^[a-f0-9]{24}$/i.test(before)) throw new Error('Invalid chat cursor');
        const end = all.findIndex(message => String(message._id) === before);
        if (end < 0) return { ...chatWindow(all, null, limit), reset: true };
        const start = Math.max(0, end - limit);
        return { messages: all.slice(start, end), hasEarlier: start > 0, hasMore: false, reset: false };
    }
    const index = after ? all.findIndex(message => String(message._id) === after) : -1;
    const reset = Boolean(after && index < 0);
    const start = after && index >= 0 ? index + 1 : Math.max(0, all.length - limit);
    const page = all.slice(start, start + limit);
    return { messages: page, reset, hasMore: start + page.length < all.length,
        hasEarlier: start > 0 && (!after || reset), cursor: page.length ? String(page[page.length - 1]._id) : after || null };
}
module.exports = { chatWindow };
