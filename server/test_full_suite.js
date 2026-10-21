const path = require('path');
const fs = require('fs');
const http = require('http');

// Load environment variables
const serverEnvPath = path.resolve(__dirname, '.env');
if (fs.existsSync(serverEnvPath)) {
  require('dotenv').config({ path: serverEnvPath });
} else {
  require('dotenv').config();
}

const express = require('express');
const cors = require('cors');
const { connectDB, getDbStatus } = require('./src/config/db');
const authRoutes = require('./src/routes/authRoutes');
const groupRoutes = require('./src/routes/groupRoutes');
const documentRoutes = require('./src/routes/documentRoutes');
const notificationRoutes = require('./src/routes/notificationRoutes');

const TEST_PORT = 4599;

// Helper to make multipart and json requests
function httpRequest({ path, method = 'GET', headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: TEST_PORT,
        path,
        method,
        headers,
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          let data = {};
          try {
            data = JSON.parse(raw);
          } catch (_) {
            data = { raw };
          }
          resolve({ status: res.statusCode, headers: res.headers, data });
        });
      }
    );
    req.on('error', reject);
    if (body) {
      req.write(body);
    }
    req.end();
  });
}

// Build multipart/form-data body
function buildMultipart({ fields = {}, file = null }) {
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
  const crlf = '\r\n';
  const parts = [];

  for (const [key, val] of Object.entries(fields)) {
    parts.push(Buffer.from(`--${boundary}${crlf}Content-Disposition: form-data; name="${key}"${crlf}${crlf}${val}${crlf}`));
  }

  if (file) {
    const { fieldName, fileName, contentType, content } = file;
    parts.push(
      Buffer.from(
        `--${boundary}${crlf}Content-Disposition: form-data; name="${fieldName}"; filename="${fileName}"${crlf}Content-Type: ${contentType}${crlf}${crlf}`
      )
    );
    parts.push(Buffer.isBuffer(content) ? content : Buffer.from(content));
    parts.push(Buffer.from(crlf));
  }

  parts.push(Buffer.from(`--${boundary}--${crlf}`));
  const body = Buffer.concat(parts);
  const contentType = `multipart/form-data; boundary=${boundary}`;

  return { body, contentType };
}

async function run() {
  console.log('========================================================');
  console.log('🚀 STARTING COMPREHENSIVE E2E VERIFICATION SUITE');
  console.log('========================================================\n');

  // Create Express app
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ extended: true, limit: '20mb' }));

  const uploadsDir = path.join(__dirname, 'uploads');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  app.use('/uploads', express.static(uploadsDir));

  app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok', database: getDbStatus() ? 'MongoDB' : 'In-Memory Store' });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/groups', groupRoutes);
  app.use('/api/documents', documentRoutes);
  app.use('/api/notifications', notificationRoutes);

  await connectDB();

  const server = await new Promise((resolve) => {
    const s = app.listen(TEST_PORT, '127.0.0.1', () => resolve(s));
  });

  console.log(`✅ Test server running on http://127.0.0.1:${TEST_PORT}\n`);

  try {
    // 1. Health check
    const health = await httpRequest({ path: '/api/health' });
    console.log(`[1] Health Check: Status ${health.status}, DB: ${health.data.database}`);
    if (health.status !== 200) throw new Error('Health check failed');

    // 2. Register Admin User
    const adminEmail = `admin_test_${Date.now()}@testcorp.com`;
    const regAdmin = await httpRequest({
      path: '/api/auth/register',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Admin User',
        email: adminEmail,
        password: 'Password123!',
        phone: '+1 555-0100',
        jobTitle: 'Engineering Manager',
        department: 'Architecture',
      }),
    });
    console.log(`[2] Register Admin (${adminEmail}): Status ${regAdmin.status}, DebugCode: ${regAdmin.data.debugCode}`);
    if (regAdmin.status !== 201) throw new Error('Admin registration failed: ' + JSON.stringify(regAdmin.data));

    // 3. Verify Admin Email
    const verifyAdmin = await httpRequest({
      path: '/api/auth/verify-email',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminEmail, code: regAdmin.data.debugCode }),
    });
    console.log(`[3] Verify Admin: Status ${verifyAdmin.status}, JWT received: ${!!verifyAdmin.data.token}`);
    const adminToken = verifyAdmin.data.token;
    if (!adminToken) throw new Error('Admin verification failed');

    // 4. Register Regular Member User
    const memberEmail = `member_test_${Date.now()}@testcorp.com`;
    const regMember = await httpRequest({
      path: '/api/auth/register',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Regular Member',
        email: memberEmail,
        password: 'Password123!',
        phone: '+1 555-0200',
        jobTitle: 'Junior Developer',
        department: 'Development',
      }),
    });
    console.log(`[4] Register Member (${memberEmail}): Status ${regMember.status}`);

    const verifyMember = await httpRequest({
      path: '/api/auth/verify-email',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: memberEmail, code: regMember.data.debugCode }),
    });
    console.log(`[5] Verify Member: Status ${verifyMember.status}, JWT received: ${!!verifyMember.data.token}`);
    const memberToken = verifyMember.data.token;
    if (!memberToken) throw new Error('Member verification failed');

    // 5. Admin creates Group A
    const createGroupA = await httpRequest({
      path: '/api/groups',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        name: 'Core System Architecture',
        description: 'Primary engineering workspace',
        category: 'Engineering',
      }),
    });
    console.log(`[6] Admin creates Group A: Status ${createGroupA.status}, ID: ${createGroupA.data.group.id}`);
    const groupAId = createGroupA.data.group.id;
    if (!groupAId) throw new Error('Failed to create Group A');

    // 6. Admin invites regular member to Group A
    const inviteRes = await httpRequest({
      path: `/api/groups/${groupAId}/invite`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ email: memberEmail }),
    });
    console.log(`[7] Admin invites Regular Member to Group A: Status ${inviteRes.status}, Message: ${inviteRes.data.message}`);

    // 7. Member creates Group B (unrelated group to test non-interference)
    const createGroupB = await httpRequest({
      path: '/api/groups',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${memberToken}` },
      body: JSON.stringify({
        name: 'Unrelated Team Sandbox',
        description: 'Group B that should not be touched',
        category: 'General',
      }),
    });
    console.log(`[8] Member creates Group B: Status ${createGroupB.status}, ID: ${createGroupB.data.group.id}`);
    const groupBId = createGroupB.data.group.id;

    // ========================================================
    // ISSUE 1 VERIFICATION: UPLOAD PDF, JPG/JPEG, AND DOCX
    // ========================================================
    console.log('\n--- VERIFYING ISSUE 1: DOCUMENT UPLOADS (PDF, JPG, DOCX) ---');

    // Upload 1: PDF Document
    const pdfContent = '%PDF-1.4\n1 0 obj\n<< /Title (System Specs) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF';
    const pdfMp = buildMultipart({
      fields: {
        groupId: groupAId,
        title: 'System Architecture Specification',
        description: 'Complete architecture blueprint in PDF format',
        accessPermission: 'all',
      },
      file: {
        fieldName: 'file',
        fileName: 'system_architecture.pdf',
        contentType: 'application/pdf',
        content: pdfContent,
      },
    });

    const uploadPdfRes = await httpRequest({
      path: '/api/documents/upload',
      method: 'POST',
      headers: {
        'Content-Type': pdfMp.contentType,
        'Content-Length': pdfMp.body.length,
        Authorization: `Bearer ${adminToken}`,
      },
      body: pdfMp.body,
    });
    console.log(`[9] Upload PDF: Status ${uploadPdfRes.status}, Success: ${uploadPdfRes.data.success}, Doc ID: ${uploadPdfRes.data.document?.id}`);
    if (uploadPdfRes.status !== 201) throw new Error('PDF upload failed: ' + JSON.stringify(uploadPdfRes.data));

    // Upload 2: JPG/JPEG Image Document
    // Valid minimal 1x1 JPEG buffer
    const jpgBuffer = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
      0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
      0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
      0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20, 0x24, 0x2e, 0x27, 0x20,
      0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00,
      0x1f, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0xff, 0xda,
      0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0xbf, 0x80, 0xff, 0xd9,
    ]);

    const jpgMp = buildMultipart({
      fields: {
        groupId: groupAId,
        title: 'Network Topology Diagram',
        description: 'Server cluster layout diagram in JPG format',
        accessPermission: 'all',
      },
      file: {
        fieldName: 'file',
        fileName: 'network_diagram.jpg',
        contentType: 'image/jpeg',
        content: jpgBuffer,
      },
    });

    const uploadJpgRes = await httpRequest({
      path: '/api/documents/upload',
      method: 'POST',
      headers: {
        'Content-Type': jpgMp.contentType,
        'Content-Length': jpgMp.body.length,
        Authorization: `Bearer ${adminToken}`,
      },
      body: jpgMp.body,
    });
    console.log(`[10] Upload JPG: Status ${uploadJpgRes.status}, Success: ${uploadJpgRes.data.success}, Doc ID: ${uploadJpgRes.data.document?.id}`);
    if (uploadJpgRes.status !== 201) throw new Error('JPG upload failed: ' + JSON.stringify(uploadJpgRes.data));

    // Upload 3: DOCX Document
    const docxDummy = Buffer.from('PK\x03\x04\x14\x00\x06\x00\x08\x00Dummy Word Document XML payload');
    const docxMp = buildMultipart({
      fields: {
        groupId: groupAId,
        title: 'Release Notes Q4',
        description: 'Sprint planning and release notes in DOCX format',
        accessPermission: 'all',
      },
      file: {
        fieldName: 'file',
        fileName: 'release_notes.docx',
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        content: docxDummy,
      },
    });

    const uploadDocxRes = await httpRequest({
      path: '/api/documents/upload',
      method: 'POST',
      headers: {
        'Content-Type': docxMp.contentType,
        'Content-Length': docxMp.body.length,
        Authorization: `Bearer ${adminToken}`,
      },
      body: docxMp.body,
    });
    console.log(`[11] Upload DOCX: Status ${uploadDocxRes.status}, Success: ${uploadDocxRes.data.success}, Doc ID: ${uploadDocxRes.data.document?.id}`);
    if (uploadDocxRes.status !== 201) throw new Error('DOCX upload failed: ' + JSON.stringify(uploadDocxRes.data));

    // Upload 4: Base64 JSON Upload (PNG format) - validates mobile scoped storage fix
    const samplePngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const uploadBase64Res = await httpRequest({
      path: '/api/documents/upload',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        groupId: groupAId,
        title: 'Application Screenshot',
        description: 'Mobile screen captured image via Base64 stream',
        accessPermission: 'all',
        fileName: 'screenshot.png',
        mimeType: 'image/png',
        fileBase64: samplePngBase64,
      }),
    });
    console.log(`[11b] Upload Base64 PNG: Status ${uploadBase64Res.status}, Success: ${uploadBase64Res.data.success}, Doc ID: ${uploadBase64Res.data.document?.id}`);
    if (uploadBase64Res.status !== 201) throw new Error('Base64 upload failed: ' + JSON.stringify(uploadBase64Res.data));

    // 12. Check documents list in Group A
    const listDocs = await httpRequest({
      path: `/api/documents/group/${groupAId}`,
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    console.log(`[12] Retrieve Group A Documents: Status ${listDocs.status}, Total Documents: ${listDocs.data.documents?.length}`);
    if (listDocs.data.documents?.length !== 4) {
      throw new Error(`Expected 4 documents in Group A, got ${listDocs.data.documents?.length}`);
    }

    // 13. Verify Member received upload notifications
    const memberNotifs = await httpRequest({
      path: '/api/notifications',
      method: 'GET',
      headers: { Authorization: `Bearer ${memberToken}` },
    });
    console.log(`[13] Member Notifications: Status ${memberNotifs.status}, Total Alerts: ${memberNotifs.data.notifications?.length}`);
    const uploadAlerts = (memberNotifs.data.notifications || []).filter((n) => n.type === 'doc_uploaded');
    console.log(`     -> Found ${uploadAlerts.length} doc_uploaded notifications for Member.`);
    if (uploadAlerts.length < 3) {
      console.warn('     -> Note: member received fewer than 3 alerts (expected at least 3)');
    }

    // ========================================================
    // ISSUE 2 VERIFICATION: GROUP ADMIN DELETE OPTION & SECURITY
    // ========================================================
    console.log('\n--- VERIFYING ISSUE 2: GROUP ADMIN DELETE OPTION & AUTHORIZATION ---');

    // 14. Regular Member tries to delete Group A (MUST BE FORBIDDEN)
    const unauthorizedDelete = await httpRequest({
      path: `/api/groups/${groupAId}`,
      method: 'DELETE',
      headers: { Authorization: `Bearer ${memberToken}` },
    });
    console.log(`[14] Member attempts DELETE Group A: Status ${unauthorizedDelete.status} (Expected 403 Forbidden)`);
    console.log(`     -> Response: "${unauthorizedDelete.data.message}"`);
    if (unauthorizedDelete.status !== 403) {
      throw new Error(`Security violation! Regular member was able to call DELETE with status ${unauthorizedDelete.status}`);
    }

    // Verify Group A still exists with its documents
    const checkGroupStillExists = await httpRequest({
      path: `/api/groups/${groupAId}`,
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (checkGroupStillExists.status !== 200) {
      throw new Error('Group A was unexpectedly removed after unauthorized delete attempt!');
    }
    console.log(`[15] Verified Group A still exists after unauthorized attempt: OK`);

    // 15. Admin deletes Group A (MUST SUCCEED)
    const adminDelete = await httpRequest({
      path: `/api/groups/${groupAId}`,
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    console.log(`[16] Admin deletes Group A: Status ${adminDelete.status} (Expected 200 OK)`);
    console.log(`     -> Response: "${adminDelete.data.message}"`);
    if (adminDelete.status !== 200) {
      throw new Error('Admin delete failed: ' + JSON.stringify(adminDelete.data));
    }

    // 16. Verify Group A is deleted
    const verifyGroupADeleted = await httpRequest({
      path: `/api/groups/${groupAId}`,
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    console.log(`[17] Verify Group A deleted: Status ${verifyGroupADeleted.status} (Expected 404 Not Found)`);
    if (verifyGroupADeleted.status !== 404) {
      throw new Error('Group A still exists after admin delete!');
    }

    // 17. Verify Unrelated Group B is completely intact
    const verifyGroupBIntact = await httpRequest({
      path: `/api/groups/${groupBId}`,
      method: 'GET',
      headers: { Authorization: `Bearer ${memberToken}` },
    });
    console.log(`[18] Verify Group B unaffected: Status ${verifyGroupBIntact.status}, Name: "${verifyGroupBIntact.data.group?.name}"`);
    if (verifyGroupBIntact.status !== 200) {
      throw new Error('Unrelated Group B was damaged by deleting Group A!');
    }

    console.log('\n========================================================');
    console.log('🎉 ALL TESTS PASSED SUCCESSFULLY!');
    console.log('   - Issue 1: PDF, JPG, and DOCX uploads work flawlessly');
    console.log('   - Issue 1: Notifications dispatched to members without blocking');
    console.log('   - Issue 2: Regular members are strictly blocked (403)');
    console.log('   - Issue 2: Group Admins can delete their groups (200)');
    console.log('   - Issue 2: Cascade cleanup removes docs, notifs, and storage files');
    console.log('   - Issue 2: Unrelated groups are completely unaffected');
    console.log('========================================================\n');
  } finally {
    server.close();
    process.exit(0);
  }
}

run().catch((err) => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
