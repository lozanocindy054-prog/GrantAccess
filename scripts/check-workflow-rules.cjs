const fs = require('node:fs');
const path = require('node:path');
const auth = require(path.join(process.env.APPDATA, 'npm/node_modules/firebase-tools/lib/auth.js'));

(async () => {
  const email = process.argv[2];
  const account = auth.getAllAccounts().find(item => item.user.email === email);
  if (!account) throw new Error('Pass the email of a signed-in Firebase CLI account with project access.');
  const token = await auth.getAccessToken(account.tokens.refresh_token, ['https://www.googleapis.com/auth/cloud-platform', 'https://www.googleapis.com/auth/firebase']);
  const time = '2026-11-11T00:00:00Z';
  const application = { organizationId: 'school1', studentId: 'student1', status: 'Pending', remarks: '', scholarshipAmount: '1000' };
  const review = { ...application, status: 'Approved', remarks: 'Reviewed', rejectionReason: '', reviewedBy: 'school1', reviewedAt: time, updatedAt: time };
  const records = {
    'organizations/school1': { role: 'lgu_school' },
    'organizations/school2': { role: 'lgu_school' },
    'organizationApplicants/school1/students/student1': { applicationId: 'app1' },
    'applications/app1': application,
    'organizationPosts/post1': { organizationId: 'school1', status: 'published' },
    'studentAnnouncements/post1': { organizationId: 'school1' },
  };
  const base = '/databases/%28default%29/documents/';
  const mocks = [
    ...Object.entries(records).flatMap(([key, data]) => [
      { function: 'get', args: [{ exactValue: base + key }], result: { value: { data } } },
      { function: 'exists', args: [{ exactValue: base + key }], result: { value: true } },
    ]),
    { function: 'exists', args: [{ anyValue: {} }], result: { value: false } },
  ];
  const cases = [];
  const add = (name, uid, resourcePath, method, expectation, resourceData, data) => {
    cases.push({ name, test: {
      expectation,
      request: { path: '/databases/(default)/documents/' + resourcePath, method, auth: uid ? { uid, token: { admin: false, email_verified: true } } : null, time,
        ...(data ? { resource: { data } } : {}) },
      resource: { data: resourceData || {} }, functionMocks: mocks,
    } });
  };
  add('organization can review its application', 'school1', 'applications/app1', 'update', 'ALLOW', application, review);
  add('other organization cannot review application', 'school2', 'applications/app1', 'update', 'DENY', application, { ...review, reviewedBy: 'school2' });
  add('review cannot alter applicant identity', 'school1', 'applications/app1', 'update', 'DENY', application, { ...review, studentId: 'student2' });
  add('review cannot alter scholarship amount', 'school1', 'applications/app1', 'update', 'DENY', application, { ...review, scholarshipAmount: '9999' });
  add('reviewer identity cannot be forged', 'school1', 'applications/app1', 'update', 'DENY', application, { ...review, reviewedBy: 'school2' });
  add('review rejects unsupported status', 'school1', 'applications/app1', 'update', 'DENY', application, { ...review, status: 'Invalid' });
  add('review requires current server timestamp', 'school1', 'applications/app1', 'update', 'DENY', application, { ...review, reviewedAt: '2020-01-01T00:00:00Z' });
  add('organization can watch actual applicant presence', 'school1', 'studentPresence/student1', 'get', 'ALLOW', { studentId: 'student1', online: true });
  add('other organization cannot watch applicant presence', 'school2', 'studentPresence/student1', 'get', 'DENY', { studentId: 'student1', online: true });
  add('private student profile remains inaccessible to organizations', 'school1', 'students/student1', 'get', 'DENY', { role: 'student' });
  add('organization can link its applicant', 'school1', 'organizationApplicants/school1/students/student1', 'create', 'ALLOW', {}, { applicationId: 'app1' });
  add('organization cannot link an unrelated student', 'school1', 'organizationApplicants/school1/students/student2', 'create', 'DENY', {}, { applicationId: 'app1' });
  const announcement = { organizationId: 'school1', postId: 'post1', title: 'New scholarship', message: 'A scholarship is available.', type: 'scholarship', createdAt: time };
  add('organization can announce its published post', 'school1', 'studentAnnouncements/post1', 'create', 'ALLOW', {}, announcement);
  add('other organization cannot announce another organization post', 'school2', 'studentAnnouncements/post1', 'create', 'DENY', {}, { ...announcement, organizationId: 'school2' });
  add('student can read shared announcement', 'student1', 'studentAnnouncements/post1', 'get', 'ALLOW', announcement);
  add('student can mark announcement read for themselves', 'student1', 'studentAnnouncementReads/student1/items/post1', 'create', 'ALLOW', {}, { isRead: true, readAt: time });
  add('student cannot change another student read state', 'student2', 'studentAnnouncementReads/student1/items/post1', 'create', 'DENY', {}, { isRead: true, readAt: time });
  const organizationRead = { isRead: true, readAt: time };
  add('organization can save its notification read receipt', 'school1', 'users/school1/notifications/application_app1', 'create', 'ALLOW', {}, organizationRead);
  add('organization can read its notification receipts', 'school1', 'users/school1/notifications/application_app1', 'list', 'ALLOW', organizationRead);
  add('organization can mark existing receipt read', 'school1', 'users/school1/notifications/application_app1', 'update', 'ALLOW', { isRead: false }, organizationRead);
  add('another organization cannot mark notifications read', 'school2', 'users/school1/notifications/application_app1', 'create', 'DENY', {}, organizationRead);
  add('another organization cannot read notification receipts', 'school2', 'users/school1/notifications/application_app1', 'list', 'DENY', organizationRead);
  const adminAuth = { uid: 'admin1', token: { admin: true, email: 'admin@example.com' } };
  const adminCase = (name, target, method, expectation, data, oldData = {}) => {
    add(name, 'admin1', target, method, expectation, oldData, data);
    cases[cases.length - 1].test.request.auth = adminAuth;
  };
  adminCase('administrator can list student profiles', 'students/student1', 'list', 'ALLOW');
  adminCase('administrator can list activity records', 'activityLogs/log1', 'list', 'ALLOW');
  add('student cannot list activity records', 'student1', 'activityLogs/log1', 'list', 'DENY');
  const activity = { userId: 'admin1', userName: 'Admin', userEmail: 'admin@example.com', role: 'admin', action: 'Application reviewed', description: 'Reviewed application app1.', status: 'Success', createdAt: time };
  adminCase('administrator can append own activity', 'activityLogs/log1', 'create', 'ALLOW', activity);
  add('student cannot forge administrator activity', 'student1', 'activityLogs/log1', 'create', 'DENY', {}, activity);
  adminCase('administrator cannot impersonate another actor in logs', 'activityLogs/log1', 'create', 'DENY', { ...activity, userId: 'other' });
  adminCase('activity records cannot be edited', 'activityLogs/log1', 'update', 'DENY', { ...activity, description: 'Changed' }, activity);
  adminCase('administrator can review any application', 'applications/app1', 'update', 'ALLOW', { ...review, reviewedBy: 'admin1' }, application);
  const response = await fetch('https://firebaserules.googleapis.com/v1/projects/grand-access:test', {
    method: 'POST', headers: { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ source: { files: [{ name: 'firestore.rules', content: fs.readFileSync('firestore.rules', 'utf8') }] }, testSuite: { testCases: cases.map(item => item.test) } }),
  });
  const result = await response.json();
  if (!response.ok || result.issues?.some(issue => issue.severity === 'ERROR')) throw new Error(JSON.stringify(result.error || result.issues));
  cases.forEach((item, index) => {
    const test = result.testResults?.[index];
    console.log(`${test?.state || 'MISSING'}: ${item.name}`);
    if (test?.state !== 'SUCCESS') { console.log(JSON.stringify(test)); process.exitCode = 1; }
  });
})().catch(error => { console.error(error.message); process.exitCode = 1; });
