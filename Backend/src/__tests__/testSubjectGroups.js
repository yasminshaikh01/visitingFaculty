/**
 * Integration test for Super Admin subject-groups APIs
 * Run: node src/__tests__/testSubjectGroups.js
 */

const BASE = 'http://localhost:5000/api';

async function request(method, path, body = null, token = null) {
    const opts = {
        method,
        headers: { 'Content-Type': 'application/json' },
    };
    if (token) opts.headers['Authorization'] = `Bearer ${token}`;
    if (body) opts.body = JSON.stringify(body);

    try {
        const res = await fetch(`${BASE}${path}`, opts);
        const data = await res.json();
        return { status: res.status, data };
    } catch (e) {
        return { status: 500, error: e.message };
    }
}

function log(label, result) {
    const success = result.data?.success || (result.status >= 200 && result.status < 300);
    const icon = success ? '✅' : '❌';
    console.log(`${icon} ${label}`);
    console.log(`   Status: ${result.status}`);
    if (result.data) {
        console.log(`   Response:`, JSON.stringify(result.data, null, 2).split('\n').map((l, i) => i === 0 ? l : '   ' + l).join('\n'));
    } else {
        console.log(`   Error:`, result.error);
    }
    console.log('');
    return result;
}

async function main() {
    console.log('='.repeat(70));
    console.log('  SUBJECT GROUPS API TEST SUITE');
    console.log('='.repeat(70));
    console.log('');

    // ─── Step 1: Login as super_admin ───
    console.log('─── STEP 1: Login ───');
    const loginRes = log('POST /auth/login (super_admin)', await request('POST', '/auth/login', {
        email: 'abc@gmail.com',
        password: 'ADMIN'
    }));

    if (!loginRes.data?.success) {
        console.error('❌ Cannot proceed without login. Exiting.');
        process.exit(1);
    }

    const token = loginRes.data.data.token;
    console.log(`   🔑 Token obtained: ${token.substring(0, 30)}...\n`);

    // ─── Setup Prerequisites: Course, Semester, Subjects ───
    console.log('─── SETUP Prerequisites ───');
    const courseRes = await request('POST', '/super_admin/addCourse', {
        course_name: 'Group Test Course',
        program_incharge: 'Test Incharge',
        total_semesters: 1,
        year: 2026
    }, token);
    const courseId = courseRes.data?.data?.course_id;

    const semRes = await request('POST', `/super_admin/addSemester/${courseId}`, { semester_number: 1 }, token);

    const sub1Res = await request('POST', `/super_admin/addSubject/${courseId}/1`, {
        subject_code: 'GRP-101',
        subject_name: 'Group Subject 1'
    }, token);
    const sub1Id = sub1Res.data?.data?.subject_id;

    const sub2Res = await request('POST', `/super_admin/addSubject/${courseId}/1`, {
        subject_code: 'GRP-102',
        subject_name: 'Group Subject 2'
    }, token);
    const sub2Id = sub2Res.data?.data?.subject_id;
    console.log(`   📋 Setup complete. Sub1: ${sub1Id}, Sub2: ${sub2Id}\n`);

    // ─── Step 2: Get all subject groups ───
    console.log('─── STEP 2: Get all subject groups ───');
    const getRes1 = log('GET /super_admin/subject-groups', await request('GET', '/super_admin/subject-groups', null, token));

    // ─── Step 3: Create a subject group ───
    console.log('─── STEP 3: Create a subject group ───');
    const createRes = log('POST /super_admin/subject-groups', await request('POST', '/super_admin/subject-groups', {
        group_name: 'Test Group API',
        combined_code: 'TEST_COMBINED_CODE',
        subject_ids: [sub1Id, sub2Id] 
    }, token));

    let groupId = null;
    if (createRes.data?.success && createRes.data?.data) {
        groupId = createRes.data.data.group_id;
        console.log(`   📋 Created group_id: ${groupId}\n`);
    }

    // ─── Step 4: Get all subject groups to verify creation ───
    console.log('─── STEP 4: Get all subject groups (Verify Creation) ───');
    log('GET /super_admin/subject-groups', await request('GET', '/super_admin/subject-groups', null, token));

    // ─── Step 5: Delete the subject group ───
    console.log('─── STEP 5: Delete the subject group ───');
    if (groupId) {
        log(`DELETE /super_admin/subject-groups/${groupId}`, await request('DELETE', `/super_admin/subject-groups/${groupId}`, null, token));
    } else {
        console.log('⚠️  Skipping delete: no group_id created\n');
    }

    // ─── Step 6: Get all subject groups to verify deletion ───
    console.log('─── STEP 6: Get all subject groups (Verify Deletion) ───');
    log('GET /super_admin/subject-groups', await request('GET', '/super_admin/subject-groups', null, token));

    // ─── Cleanup Prerequisites ───
    console.log('─── CLEANUP Prerequisites ───');
    if (sub1Id) await request('DELETE', `/super_admin/deleteSubject/${courseId}/1/${sub1Id}`, null, token);
    if (sub2Id) await request('DELETE', `/super_admin/deleteSubject/${courseId}/1/${sub2Id}`, null, token);
    await request('DELETE', `/super_admin/deleteSemester/${courseId}/1`, null, token);
    if (courseId) await request('DELETE', `/super_admin/deleteCourse/${courseId}`, null, token);
    console.log(`   🧹 Cleanup complete.\n`);

    console.log('='.repeat(70));
    console.log('  TEST SUITE COMPLETE');
    console.log('='.repeat(70));
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
