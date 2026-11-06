const test = require('node:test');
const assert = require('node:assert/strict');
const { chatWindow } = require('../src/utils/chatHistory');
const { verifiedPhoto } = require('../src/utils/profilePhoto');
const cloudinary = require('cloudinary').v2;
const id = number => number.toString(16).padStart(24, '0');
test('initial mobile history is bounded; cursors return only following messages and preserve equal text', () => {
 const messages = Array.from({ length: 700 }, (_, i) => ({ _id: id(i + 1), text: 'same' }));
 const initial = chatWindow(messages); assert.equal(initial.messages.length, 300); assert.equal(initial.hasEarlier, true); assert.equal(initial.cursor, id(700));
 const delta = chatWindow(messages, id(695)); assert.equal(delta.messages.length, 5); assert.equal(delta.messages[0]._id, id(696));
 assert.equal(chatWindow(messages, id(700)).messages.length, 0);
 const first = chatWindow(messages, id(1)); assert.equal(first.messages.length, 300); assert.equal(first.hasMore, true);
 const reset = chatWindow(messages, id(1000)); assert.equal(reset.reset, true); assert.equal(reset.messages.length, 300);
 assert.throws(() => chatWindow(messages, 'bad-cursor'));
 const earlier = chatWindow(messages, null, 300, id(401)); assert.equal(earlier.messages.length, 300); assert.equal(earlier.messages[0]._id, id(101)); assert.equal(earlier.hasEarlier, true);
});
test('profile photo completion verifies provider signature and authenticated ownership before deriving URL', () => {
 const userId = id(1), config = { apiSecret: 'fixture-only-signing-key', cloudName: 'fixture-cloud' };
 const publicId = 'devtinder/avatars/' + userId + '-fixture'; const version = 123;
 const signature = cloudinary.utils.api_sign_request({ public_id: publicId, version }, config.apiSecret);
 const body = { publicId, version, signature, format: 'jpg' };
 const url = verifiedPhoto(body, userId, config, cloudinary);
 assert.match(url, /^https:\/\/res.cloudinary.com\/fixture-cloud\/image\/upload\/v123\//);
 assert.throws(() => verifiedPhoto({ ...body, signature: 'a'.repeat(40) }, userId, config, cloudinary));
 assert.throws(() => verifiedPhoto(body, id(2), config, cloudinary));
 assert.throws(() => verifiedPhoto({ ...body, format: 'pdf' }, userId, config, cloudinary));
 assert.throws(() => verifiedPhoto({ ...body, publicId: '../someone' }, userId, config, cloudinary));
});
