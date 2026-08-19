/**
 * Integration test for all Super Admin course-related APIs
 * Run: node src/__tests__/testSuperAdminAPIs.js
 */

const BASE = 'http://localhost:5000/api';

async function request(method, path, body = null, token = null) {
    const opts = {
        method,
        headers: { 'Content-Type': 'application/json' },
    };
    if (token) opts.headers['Authorization'] = `Bearer ${token}`;
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(`${BASE}${path}`, opts);
    const data = await res.json();
    return { status: res.status, data };
}

function log(label, result) {
    const icon = result.data?.success ? '✅' : '❌';
    console.log(`${icon} ${label}`);
    console.log(`   Status: ${result.status}`);
    console.log(`   Response:`, JSON.stringify(result.data, null, 2).split('\n').map((l, i) => i === 0 ? l : '   ' + l).join('\n'));
    console.log('');
    return result;
}

async function main() {
    console.log('='.repeat(70));
    console.log('  SUPER ADMIN API TEST SUITE');
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

    // ─── Step 2: Course Dashboard ───
    console.log('─── STEP 2: Course Dashboard ───');
    log('GET /super_admin/courseDashboard', await request('GET', '/super_admin/courseDashboard', null, token));

    // ─── Step 3: Course Dashboard by ID ───
    console.log('─── STEP 3: Course Dashboard by ID (course_id=1) ───');
    log('GET /super_admin/courseDashboard/1', await request('GET', '/super_admin/courseDashboard/1', null, token));

    // ─── Step 4: Add Course ───
    console.log('─── STEP 4: Add Course ───');
    const addCourseRes = log('POST /super_admin/addCourse', await request('POST', '/super_admin/addCourse', {
        course_name: 'TEST_COURSE_API',
        program_incharge: 'Test Incharge',
        total_semesters: 2,
        year: 2026
    }, token));

    const newCourseId = addCourseRes.data?.data?.course_id;
    console.log(`   📋 New course_id: ${newCourseId}\n`);

    // ─── Step 5: Add Section ───
    console.log('─── STEP 5: Add Section ───');
    const addSectionRes = log(`POST /super_admin/addSection/${newCourseId}`, await request('POST', `/super_admin/addSection/${newCourseId}`, {
        section_name: 'A'
    }, token));

    const newSectionId = addSectionRes.data?.data?.section_id;
    console.log(`   📋 New section_id: ${newSectionId}\n`);

    // ─── Step 6: Update Incharge ───
    console.log('─── STEP 6: Update Incharge ───');
    log(`PUT /super_admin/updateIncharge/${newCourseId}`, await request('PUT', `/super_admin/updateIncharge/${newCourseId}`, {
        program_incharge: 'Updated Incharge'
    }, token));

    // ─── Step 7: Add Semester ───
    console.log('─── STEP 7: Add Semester ───');
    const addSemRes = log(`POST /super_admin/addSemester/${newCourseId}`, await request('POST', `/super_admin/addSemester/${newCourseId}`, {
        semester_number: 1
    }, token));
    console.log(`   📋 New semester:`, addSemRes.data?.data, '\n');

    // ─── Step 8: Show Subjects (semester_number=1) ───
    console.log('─── STEP 8: Show Subjects (semester 1) ───');
    log(`GET /super_admin/subjects/${newCourseId}/1`, await request('GET', `/super_admin/subjects/${newCourseId}/1`, null, token));

    // ─── Step 9: Add Subject ───
    console.log('─── STEP 9: Add Subject ───');
    const addSubRes = log(`POST /super_admin/addSubject/${newCourseId}/1`, await request('POST', `/super_admin/addSubject/${newCourseId}/1`, {
        subject_code: 'TEST-101',
        subject_name: 'Test Subject Alpha'
    }, token));

    const newSubjectId = addSubRes.data?.data?.subject_id;
    console.log(`   📋 New subject_id: ${newSubjectId}\n`);

    // ─── Step 10: Show Subjects again (should have 1) ───
    console.log('─── STEP 10: Show Subjects again (should have 1 subject) ───');
    log(`GET /super_admin/subjects/${newCourseId}/1`, await request('GET', `/super_admin/subjects/${newCourseId}/1`, null, token));

    // ─── Step 11: Add another Subject ───
    console.log('─── STEP 11: Add another Subject ───');
    const addSubRes2 = log(`POST /super_admin/addSubject/${newCourseId}/1`, await request('POST', `/super_admin/addSubject/${newCourseId}/1`, {
        subject_code: 'TEST-102',
        subject_name: 'Test Subject Beta'
    }, token));

    const newSubjectId2 = addSubRes2.data?.data?.subject_id;

    // ─── Step 12: Delete Subject ───
    console.log('─── STEP 12: Delete Subject ───');
    if (newSubjectId2) {
        log(`DELETE /super_admin/deleteSubject/${newCourseId}/1/${newSubjectId2}`, await request('DELETE', `/super_admin/deleteSubject/${newCourseId}/1/${newSubjectId2}`, null, token));
    } else {
        console.log('⚠️  Skipping: no subject_id to delete\n');
    }

    // ─── Step 13: Delete remaining Subject ───
    console.log('─── STEP 13: Delete remaining Subject ───');
    if (newSubjectId) {
        log(`DELETE /super_admin/deleteSubject/${newCourseId}/1/${newSubjectId}`, await request('DELETE', `/super_admin/deleteSubject/${newCourseId}/1/${newSubjectId}`, null, token));
    } else {
        console.log('⚠️  Skipping: no subject_id to delete\n');
    }

    // ─── Step 14: Delete Section ───
    console.log('─── STEP 14: Delete Section ───');
    if (newSectionId) {
        log(`DELETE /super_admin/deleteSection/${newCourseId}/${newSectionId}`, await request('DELETE', `/super_admin/deleteSection/${newCourseId}/${newSectionId}`, null, token));
    } else {
        console.log('⚠️  Skipping: no section_id to delete\n');
    }

    // ─── Step 15: Delete Semester ───
    console.log('─── STEP 15: Delete Semester (semester_number=1) ───');
    log(`DELETE /super_admin/deleteSemester/${newCourseId}/1`, await request('DELETE', `/super_admin/deleteSemester/${newCourseId}/1`, null, token));

    // ─── Step 16: Delete Course ───
    console.log('─── STEP 16: Delete Course ───');
    if (newCourseId) {
        log(`DELETE /super_admin/deleteCourse/${newCourseId}`, await request('DELETE', `/super_admin/deleteCourse/${newCourseId}`, null, token));
    } else {
        console.log('⚠️  Skipping: no course_id to delete\n');
    }

    // ─── Summary ───
    console.log('='.repeat(70));
    console.log('  TEST SUITE COMPLETE');
    console.log('='.repeat(70));
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
