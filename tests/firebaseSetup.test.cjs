const test = require('node:test');
const assert = require('node:assert/strict');
const { verifyFcm } = require('../scripts/check-firebase.cjs');
const credential = { type: 'service_account', project_id: 'devtinder-fixture',
    client_email: 'fixture@devtinder-fixture.iam.gserviceaccount.com',
    private_key: '-----BEGIN PRIVATE KEY-----\nfixture-only\n-----END PRIVATE KEY-----' };

test('FCM setup only validates and never targets a real device', async () => {
    let calls = 0;
    await verifyFcm({ credential, projectId: 'devtinder-fixture', send: async (message, dryRun) => {
        calls++;
        assert.equal(dryRun, true);
        assert.equal(message.topic, 'devtinder-setup-validation');
        assert.equal(message.token, undefined);
        assert.equal(message.notification, undefined);
        assert.equal(JSON.stringify(message).includes('PRIVATE KEY'), false);
    } });
    assert.equal(calls, 1);
});

test('wrong-project, absent and client credentials cannot initiate network validation', async () => {
    for (const bad of [undefined, {}, { project_info: { project_id: 'devtinder-fixture' } },
        { ...credential, project_id: 'other-project' }]) {
        await assert.rejects(verifyFcm({ credential: bad, projectId: 'devtinder-fixture',
            send: async () => assert.fail('must not send') }));
    }
});

test('explicit expected project is mandatory and FCM rejection propagates', async () => {
    await assert.rejects(verifyFcm({ credential, send: async () => assert.fail('must not send') }));
    await assert.rejects(verifyFcm({ credential, projectId: 'devtinder-fixture',
        send: async () => { throw new Error('rejected'); } }), /rejected/);
});
