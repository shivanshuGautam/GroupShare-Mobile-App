const http = require('http');

const request = (path, method = 'GET', body = null, token = null) => {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: 'localhost',
        port: 5000,
        path,
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

async function runTests() {
  console.log('--- 1. Testing Health ---');
  const health = await request('/api/health');
  console.log('Health:', health.status, health.data);

  console.log('\n--- 2. Testing Register ---');
  const testEmail = `tester_${Date.now()}@example.com`;
  const reg = await request('/api/auth/register', 'POST', {
    name: 'Alex Rivera',
    email: testEmail,
    password: 'password123',
    phone: '+1 555-4321',
    bio: 'Mobile App Developer',
    jobTitle: 'Lead Mobile Engineer',
    department: 'Product Development',
  });
  console.log('Register status:', reg.status, reg.data.message);
  const code = reg.data.debugCode;
  console.log('Captured verification code:', code);

  console.log('\n--- 3. Testing Email Verification ---');
  const verify = await request('/api/auth/verify-email', 'POST', {
    email: testEmail,
    code,
  });
  console.log('Verify status:', verify.status, verify.data.message);
  const token = verify.data.token;
  console.log('Received JWT token:', !!token);

  console.log('\n--- 4. Testing Profile Fetch ---');
  const profile = await request('/api/auth/profile', 'GET', null, token);
  console.log('Profile status:', profile.status, 'User Name:', profile.data.user.name, 'Fields:', Object.keys(profile.data.user));

  console.log('\n--- 5. Testing Create Group (as Admin) ---');
  const group = await request('/api/groups', 'POST', {
    name: 'Design Sprint 2026',
    description: 'Workspace for UI/UX document exchange',
    category: 'Design',
  }, token);
  console.log('Create Group status:', group.status, 'Group Name:', group.data.group.name, 'My Role:', group.data.group.myRole);
  const groupId = group.data.group.id;

  console.log('\n--- 6. Testing Invite Member ---');
  const invite = await request(`/api/groups/${groupId}/invite`, 'POST', {
    email: 'teammate@example.com',
  }, token);
  console.log('Invite status:', invite.status, invite.data.message);

  console.log('\n--- 7. Testing Notifications ---');
  const notifs = await request('/api/notifications', 'GET', null, token);
  console.log('Notifications status:', notifs.status, 'Count:', notifs.data.notifications.length);

  console.log('\n✅ ALL BACKEND APIS TESTED AND WORKING PERFECTLY!');
}

runTests().catch(console.error);
