const http = require('http');
const path = require('path');
const fs = require('fs');

// Ensure server/.env is loaded
const envPath = path.resolve(__dirname, '.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

const PORT = parseInt(process.env.PORT, 10) || 4500;

const request = (endpoint, method = 'GET', body = null, token = null) => {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: 'localhost',
        port: PORT,
        path: endpoint,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(data && { 'Content-Length': Buffer.byteLength(data) }),
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      },
      (res) => {
        let responseData = '';
        res.on('data', (chunk) => (responseData += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(responseData) });
          } catch (e) {
            resolve({ status: res.statusCode, raw: responseData });
          }
        });
      }
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
};

// Helper to register and verify an account
async function createAndVerifyUser(name, email, password = 'password123') {
  const regRes = await request('/api/auth/register', 'POST', {
    name,
    email,
    password,
    phone: '+1 555-0100',
    jobTitle: 'Developer',
    department: 'Engineering',
  });
  if (regRes.status !== 201) {
    throw new Error(`Failed to register ${email}: ${JSON.stringify(regRes.data)}`);
  }

  const code = regRes.data.debugCode || regRes.data.verificationCode || '123456';
  const verifyRes = await request('/api/auth/verify-email', 'POST', {
    email,
    code,
  });

  if (verifyRes.status !== 200) {
    throw new Error(`Failed to verify ${email}: ${JSON.stringify(verifyRes.data)}`);
  }

  return {
    user: verifyRes.data.user,
    token: verifyRes.data.token,
    email,
  };
}

async function runTestSuite() {
  console.log('===============================================================');
  console.log('🚀 GROUPSHARE INVITATION & WORKFLOW END-TO-END TEST SUITE');
  console.log('===============================================================\n');

  let passedTests = 0;
  let totalTests = 12;

  // 1. Health check
  const health = await request('/api/health');
  console.log(`[Setup] Backend Health: ${health.status} (${health.data.database})`);
  if (health.status !== 200) {
    throw new Error('Backend is not running. Start server before running test suite.');
  }

  const timestamp = Date.now();
  const inviterEmail = `admin_inviter_${timestamp}@test.local`;
  const existingFriendEmail = `existing_friend_${timestamp}@test.local`;
  const unregisteredFriendEmail = `new_friend_${timestamp}@test.local`;
  const otherUserEmail = `other_attacker_${timestamp}@test.local`;

  // Create Inviter Admin & Existing Friend
  console.log('\n--- Setting up Users & Group ---');
  const inviter = await createAndVerifyUser('Sarah Inviter', inviterEmail);
  const existingFriend = await createAndVerifyUser('Bob Existing', existingFriendEmail);
  const otherUser = await createAndVerifyUser('Mallory Intruder', otherUserEmail);

  // Inviter creates a workspace group
  const groupRes = await request(
    '/api/groups',
    'POST',
    {
      name: 'Project Apollo Architecture',
      description: 'Confidential system architecture documents',
      category: 'Engineering',
    },
    inviter.token
  );
  const groupId = groupRes.data.group.id;
  console.log(`✅ Workspace Group Created: "${groupRes.data.group.name}" (ID: ${groupId})`);

  // =========================================================================
  // TEST 1: Case A - Inviting a registered user adds them directly
  // =========================================================================
  console.log('\n--- TEST 1: Case A - Inviting Already Registered User ---');
  const caseARes = await request(
    `/api/groups/${groupId}/invite`,
    'POST',
    { email: existingFriendEmail },
    inviter.token
  );
  console.log('Result:', caseARes.status, caseARes.data.message, `Action: ${caseARes.data.action}`);

  if (
    caseARes.status === 200 &&
    caseARes.data.action === 'added_directly' &&
    caseARes.data.message.includes('Friend added')
  ) {
    console.log('✅ TEST 1 PASSED: Registered user added directly with notification');
    passedTests++;
  } else {
    console.error('❌ TEST 1 FAILED:', caseARes.data);
  }

  // =========================================================================
  // TEST 2: Preventing duplicate membership
  // =========================================================================
  console.log('\n--- TEST 2: Prevent Duplicate Membership ---');
  const duplicateRes = await request(
    `/api/groups/${groupId}/invite`,
    'POST',
    { email: existingFriendEmail },
    inviter.token
  );
  console.log('Result:', duplicateRes.status, duplicateRes.data.message);

  if (
    duplicateRes.status === 400 &&
    duplicateRes.data.message.includes('already a member')
  ) {
    console.log('✅ TEST 2 PASSED: Duplicate member invite rejected');
    passedTests++;
  } else {
    console.error('❌ TEST 2 FAILED:', duplicateRes.data);
  }

  // =========================================================================
  // TEST 3: Case B - Inviting an unregistered email dispatches invitation
  // =========================================================================
  console.log('\n--- TEST 3: Case B - Inviting Unregistered User ---');
  const caseBRes = await request(
    `/api/groups/${groupId}/invite`,
    'POST',
    { email: unregisteredFriendEmail },
    inviter.token
  );
  console.log('Result:', caseBRes.status, caseBRes.data.message, `Action: ${caseBRes.data.action}`);
  const rawInviteToken = caseBRes.data.inviteToken;
  const invitationId = caseBRes.data.invitation.id;

  if (
    caseBRes.status === 201 &&
    caseBRes.data.action === 'invite_pending' &&
    rawInviteToken &&
    invitationId
  ) {
    console.log(`✅ TEST 3 PASSED: Secure invitation created with token: [${rawInviteToken.substring(0, 12)}...]`);
    passedTests++;
  } else {
    console.error('❌ TEST 3 FAILED:', caseBRes.data);
  }

  // =========================================================================
  // TEST 4: Public token lookup (deep linking preview)
  // =========================================================================
  console.log('\n--- TEST 4: Public Token Lookup (/api/invitations/:token) ---');
  const tokenPreview = await request(`/api/invitations/${rawInviteToken}`);
  console.log('Token Lookup Result:', tokenPreview.status, tokenPreview.data.invitation?.groupName);

  if (
    tokenPreview.status === 200 &&
    tokenPreview.data.invitation.email === unregisteredFriendEmail &&
    tokenPreview.data.invitation.groupName === 'Project Apollo Architecture'
  ) {
    console.log('✅ TEST 4 PASSED: Deep link token lookup returns sanitized group preview');
    passedTests++;
  } else {
    console.error('❌ TEST 4 FAILED:', tokenPreview.data);
  }

  // =========================================================================
  // TEST 5: Security - Wrong user cannot accept invitation
  // =========================================================================
  console.log('\n--- TEST 5: Security - Wrong Account Cannot Accept ---');
  const wrongUserAccept = await request(
    `/api/invitations/${invitationId}/accept`,
    'POST',
    {},
    otherUser.token
  );
  console.log('Intruder Accept Result:', wrongUserAccept.status, wrongUserAccept.data.message);

  if (
    wrongUserAccept.status === 403 &&
    wrongUserAccept.data.message.includes('Forbidden')
  ) {
    console.log('✅ TEST 5 PASSED: Unauthorized user forbidden from accepting invite for another email');
    passedTests++;
  } else {
    console.error('❌ TEST 5 FAILED:', wrongUserAccept.data);
  }

  // =========================================================================
  // TEST 6: Registration does NOT automatically add to group
  // =========================================================================
  console.log('\n--- TEST 6: Registering Invited User (No Auto-Join) ---');
  const newFriend = await createAndVerifyUser('Charlie Newcomer', unregisteredFriendEmail);

  // Verify Charlie is NOT automatically a member of Project Apollo
  const charlieGroupsBefore = await request('/api/groups', 'GET', null, newFriend.token);
  const isMemberBefore = charlieGroupsBefore.data.groups.some((g) => g.id.toString() === groupId.toString());
  console.log(`Charlie groups count: ${charlieGroupsBefore.data.groups.length}. Member of Apollo before accept? ${isMemberBefore}`);

  if (charlieGroupsBefore.status === 200 && !isMemberBefore) {
    console.log('✅ TEST 6 PASSED: Registration associates invitation without auto-adding user');
    passedTests++;
  } else {
    console.error('❌ TEST 6 FAILED: User was auto-added prematurely!');
  }

  // =========================================================================
  // TEST 7: User can fetch pending invitations
  // =========================================================================
  console.log('\n--- TEST 7: User Fetch Pending Invitations ---');
  const pendingInvites = await request('/api/invitations/pending', 'GET', null, newFriend.token);
  console.log('Pending count:', pendingInvites.data.count, 'Invitations:', pendingInvites.data.invitations?.length);

  const foundInvite = pendingInvites.data.invitations?.find(
    (i) => i.id.toString() === invitationId.toString()
  );

  if (pendingInvites.status === 200 && foundInvite) {
    console.log(`✅ TEST 7 PASSED: Pending invitation displayed in user app for "${foundInvite.groupName}"`);
    passedTests++;
  } else {
    console.error('❌ TEST 7 FAILED:', pendingInvites.data);
  }

  // =========================================================================
  // TEST 8: Accepting valid invitation adds user to group exactly once
  // =========================================================================
  console.log('\n--- TEST 8: Accept Invitation Explicitly ---');
  const acceptRes = await request(
    `/api/invitations/${invitationId}/accept`,
    'POST',
    {},
    newFriend.token
  );
  console.log('Accept Result:', acceptRes.status, acceptRes.data.message);

  const charlieGroupsAfter = await request('/api/groups', 'GET', null, newFriend.token);
  const isMemberAfter = charlieGroupsAfter.data.groups.some((g) => g.id.toString() === groupId.toString());

  if (
    acceptRes.status === 200 &&
    isMemberAfter &&
    acceptRes.data.message.includes('Congratulations')
  ) {
    console.log('✅ TEST 8 PASSED: Invitation accepted and user added to group membership');
    passedTests++;
  } else {
    console.error('❌ TEST 8 FAILED:', acceptRes.data);
  }

  // =========================================================================
  // TEST 9: Cannot accept already accepted invitation
  // =========================================================================
  console.log('\n--- TEST 9: Prevent Re-accepting Accepted Invite ---');
  const reacceptRes = await request(
    `/api/invitations/${invitationId}/accept`,
    'POST',
    {},
    newFriend.token
  );
  console.log('Reaccept Result:', reacceptRes.status, reacceptRes.data.message);

  if (
    reacceptRes.status === 400 &&
    reacceptRes.data.message.includes('already been accepted')
  ) {
    console.log('✅ TEST 9 PASSED: Re-accepting rejected cleanly');
    passedTests++;
  } else {
    console.error('❌ TEST 9 FAILED:', reacceptRes.data);
  }

  // =========================================================================
  // TEST 10: Group Admin view all invitations
  // =========================================================================
  console.log('\n--- TEST 10: Group Admin List Invitations ---');
  const adminInvites = await request(
    `/api/groups/${groupId}/invitations`,
    'GET',
    null,
    inviter.token
  );
  console.log('Group Invitations count:', adminInvites.data.invitations?.length);

  const acceptedInv = adminInvites.data.invitations?.find(
    (i) => i.id.toString() === invitationId.toString()
  );

  if (adminInvites.status === 200 && acceptedInv && acceptedInv.status === 'accepted') {
    console.log('✅ TEST 10 PASSED: Group administrator can view all invitation statuses');
    passedTests++;
  } else {
    console.error('❌ TEST 10 FAILED:', adminInvites.data);
  }

  // =========================================================================
  // TEST 11: Resend and Rate Limiting
  // =========================================================================
  console.log('\n--- TEST 11: Resend Invitation & Rate Limiting ---');
  // Create another pending invite to test resend and cancel
  const secondInviteEmail = `second_friend_${timestamp}@test.local`;
  const secondInviteRes = await request(
    `/api/groups/${groupId}/invite`,
    'POST',
    { email: secondInviteEmail },
    inviter.token
  );
  const secondInviteId = secondInviteRes.data.invitation.id;

  // Immediate resend should trigger 429 rate limit
  const rateLimitRes = await request(
    `/api/groups/${groupId}/invitations/${secondInviteId}/resend`,
    'POST',
    {},
    inviter.token
  );
  console.log('Rate limit check (immediate resend):', rateLimitRes.status, rateLimitRes.data.message);

  if (rateLimitRes.status === 429) {
    console.log('✅ TEST 11 PASSED: Resend rate limit enforced');
    passedTests++;
  } else {
    console.error('❌ TEST 11 FAILED:', rateLimitRes.data);
  }

  // =========================================================================
  // TEST 12: Cancel Invitation & Enforce Block
  // =========================================================================
  console.log('\n--- TEST 12: Cancel Invitation & Enforce Block ---');
  const cancelRes = await request(
    `/api/groups/${groupId}/invitations/${secondInviteId}`,
    'DELETE',
    null,
    inviter.token
  );
  console.log('Cancel Result:', cancelRes.status, cancelRes.data.message);

  // Now create the user for secondInviteEmail and attempt to accept
  const secondUser = await createAndVerifyUser('Second User', secondInviteEmail);
  const tryAcceptCancelled = await request(
    `/api/invitations/${secondInviteId}/accept`,
    'POST',
    {},
    secondUser.token
  );
  console.log('Attempt accept cancelled result:', tryAcceptCancelled.status, tryAcceptCancelled.data.message);

  if (
    cancelRes.status === 200 &&
    tryAcceptCancelled.status === 400 &&
    tryAcceptCancelled.data.message.includes('cancelled')
  ) {
    console.log('✅ TEST 12 PASSED: Cancelled invitation cannot be accepted');
    passedTests++;
  } else {
    console.error('❌ TEST 12 FAILED:', tryAcceptCancelled.data);
  }

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log('\n===============================================================');
  console.log(`🏁 TEST RESULTS: ${passedTests}/${totalTests} TESTS PASSED (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log('===============================================================\n');

  if (passedTests === totalTests) {
    console.log('🎉 ALL 12 INVITATION SYSTEM TESTS COMPLETED SUCCESSFULLY!');
    process.exit(0);
  } else {
    console.error('⚠️ SOME TESTS FAILED.');
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('[Fatal Test Suite Error]:', err);
  process.exit(1);
});
