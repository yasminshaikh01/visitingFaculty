const fs = require('fs');
const path = require('path');
const { Course, Semester, Section, Subject } = require('../Schema');

// Helper function to parse CSV lines cleanly handling quotes
function parseCSV(text) {
    const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length === 0) return [];

    const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;

        // RegEx to handle CSV values with commas inside quotes
        const values = [];
        let insideQuote = false;
        let currentValue = '';

        for (let charIndex = 0; charIndex < line.length; charIndex++) {
            const char = line[charIndex];
            if (char === '"' || char === "'") {
                insideQuote = !insideQuote;
            } else if (char === ',' && !insideQuote) {
                values.push(currentValue.trim().replace(/^["']|["']$/g, ''));
                currentValue = '';
            } else {
                currentValue += char;
            }
        }
        values.push(currentValue.trim().replace(/^["']|["']$/g, ''));

        // Map row to object using headers
        const row = {};
        headers.forEach((header, index) => {
            row[header] = values[index] !== undefined ? values[index] : '';
        });
        rows.push(row);
    }

    return rows;
}

// Map known course metadata (total semesters, sections, program incharge and year)
const defaultCourseMeta = {
    'C1': { name: 'MCA', semCount: 10, sections: ['A', 'B'], program_incharge: 'Dr. Shaligram Prajapat', year: 5 },
    'C2': { name: 'M.Tech(IT)', semCount: 10, sections: ['A', 'B'], program_incharge: 'Dr. Kirti Mathur', year: 5 },
    'C3': { name: 'M.Tech(CS)', semCount: 10, sections: [], program_incharge: 'Dr. Yasmin Shaikh', year: 5 },
    'C4': { name: 'MBA(MS)-5YRS', semCount: 10, sections: ['A', 'B'], program_incharge: 'Dr. Manmindar Singh', year: 5 },
    'C5': { name: 'MBA(MS)-2YRS', semCount: 4, sections: ['A', 'B', 'C'], program_incharge: 'Dr. Kapil Jain', year: 2 },
    'C6': { name: 'MBA(APR)', semCount: 4, sections: [], program_incharge: 'Dr. Anshu Bhati', year: 2 },
    'C7': { name: 'MBA(E-SHIP)', semCount: 4, sections: [], program_incharge: 'Dr. Nirmala Sawan', year: 2 },
    'C8': { name: 'Bcom(Hons)', semCount: 8, sections: [], program_incharge: 'Dr. Sujata Parwani', year: 4 },
    'C9': { name: 'MBA(TM)', semCount: 10, sections: [], program_incharge: 'Dr. Shilpa Bagdare', year: 5 }
};

/**
 * Main importer function to process CSV content or file path
 * @param {Object} options - { csvText, filePath }
 */
async function importSubjectsFromCSV(options = {}) {
    // Load all existing database records to construct caches
    const coursesList = await Course.findAll();
    const courseMap = new Map(coursesList.map(c => [c.course_code, c]));

    const semestersList = await Semester.findAll();
    const semesterMap = new Map(semestersList.map(s => [`${s.course_id}_${s.semester_number}`, s]));

    const sectionsList = await Section.findAll();
    const sectionMap = new Map(sectionsList.map(sec => [`${sec.course_id}_${sec.section_name}`, sec]));

    const subjectsList = await Subject.findAll();
    const subjectMap = new Map(subjectsList.map(sub => [`${sub.course_id}_${sub.semester_id}_${sub.subject_code.trim().toLowerCase()}`, sub]));

    // Helper functions to get or create cached objects
    async function getOrCreateCourse(code, meta) {
        if (courseMap.has(code)) {
            const course = courseMap.get(code);
            const updates = {};
            if (meta.program_incharge && course.program_incharge !== meta.program_incharge) {
                updates.program_incharge = meta.program_incharge;
            }
            if (meta.name && course.course_name !== meta.name) {
                updates.course_name = meta.name;
            }
            if (meta.semCount && course.total_semesters !== meta.semCount) {
                updates.total_semesters = meta.semCount;
            }
            if (meta.year !== undefined && course.year !== meta.year) {
                updates.year = meta.year;
            }
            if (Object.keys(updates).length > 0) {
                await course.update(updates);
            }
            return course;
        }

        const course = await Course.create({
            course_code: code,
            course_name: meta.name,
            program_incharge: meta.program_incharge || null,
            total_semesters: meta.semCount,
            year: meta.year !== undefined ? meta.year : new Date().getFullYear(),
            is_active: true
        });
        courseMap.set(code, course);
        return course;
    }

    async function ensureSemester(courseId, semesterNumber) {
        const key = `${courseId}_${semesterNumber}`;
        if (semesterMap.has(key)) {
            return semesterMap.get(key);
        }

        const sem = await Semester.create({
            course_id: courseId,
            semester_number: semesterNumber,
            is_active: true
        });
        semesterMap.set(key, sem);
        return sem;
    }

    async function ensureSection(courseId, sectionName) {
        const key = `${courseId}_${sectionName}`;
        if (sectionMap.has(key)) {
            return sectionMap.get(key);
        }

        const sec = await Section.create({
            course_id: courseId,
            section_name: sectionName,
            is_active: true
        });
        sectionMap.set(key, sec);
        return sec;
    }

    // 0. Always sync default courses and program incharges
    for (const [code, meta] of Object.entries(defaultCourseMeta)) {
        const course = await getOrCreateCourse(code, meta);

        for (let s = 1; s <= meta.semCount; s++) {
            await ensureSemester(course.course_id, s);
        }

        if (meta.sections && meta.sections.length > 0) {
            for (const secName of meta.sections) {
                await ensureSection(course.course_id, secName);
            }
        }
    }

    let rawCSVText = '';

    if (options.csvText) {
        rawCSVText = options.csvText;
    } else if (options.filePath) {
        const absolutePath = path.isAbsolute(options.filePath)
            ? options.filePath
            : path.join(__dirname, '..', options.filePath);
        if (fs.existsSync(absolutePath)) {
            rawCSVText = fs.readFileSync(absolutePath, 'utf8');
        } else {
            throw new Error(`CSV file not found at path: ${absolutePath}`);
        }
    } else {
        // Default fallback to data directory for any .csv file (e.g., Subject.csv, subjects.csv)
        const dataDir = path.join(__dirname, '../data');
        if (fs.existsSync(dataDir)) {
            const files = fs.readdirSync(dataDir);
            const csvFile = files.find(f => f.toLowerCase().endsWith('.csv'));
            if (csvFile) {
                const targetPath = path.join(dataDir, csvFile);
                console.log(`Found CSV file: ${targetPath}`);
                rawCSVText = fs.readFileSync(targetPath, 'utf8');
            }
        }

        if (!rawCSVText) {
            console.log("Default courses seeded. No CSV content or default CSV file found for subjects import.");
            return { success: true, message: "Default courses initialized. No CSV file provided or found." };
        }
    }

    const rows = parseCSV(rawCSVText);
    if (rows.length === 0) {
        return { success: true, message: "CSV file is empty.", importedCount: 0 };
    }

    console.log(`Parsed ${rows.length} rows from CSV. Starting database import...`);

    let countImported = 0;

    for (const row of rows) {
        // Flexible key matching for column names
        const courseCode = row['Course_ID'] || row['Course_Code'] || row['Course_'] || row['course_code'] || row['CourseCode'] || row['Course_id'];
        const semIdStr = row['Sem_Id'] || row['semester_id'] || row['Sem_ID'] || row['sem_id'] || row['Semester'];
        const subCode = row['Sub_Code'] || row['subject_code'] || row['Sub_code'] || row['SubjectCode'];
        const subName = row['Sub_Name'] || row['subject_name'] || row['Sub_name'] || row['SubjectName'];

        if (!courseCode || !semIdStr || !subCode || !subName) {
            continue; // Skip invalid or header-only rows
        }

        const semNum = parseInt(semIdStr, 10);
        if (isNaN(semNum)) continue;

        const cleanCourseCode = courseCode.trim();
        const cleanSubCode = subCode.trim();
        const cleanSubName = subName.trim();

        // 1. Get or create Course
        const meta = defaultCourseMeta[cleanCourseCode] || { name: cleanCourseCode, semCount: Math.max(10, semNum), sections: [] };
        
        const course = await getOrCreateCourse(cleanCourseCode, meta);

        // Ensure semesters for course exist up to semCount
        const targetSemCount = Math.max(meta.semCount, semNum);
        for (let s = 1; s <= targetSemCount; s++) {
            await ensureSemester(course.course_id, s);
        }

        // Ensure sections exist if meta specifies sections
        if (meta.sections && meta.sections.length > 0) {
            for (const secName of meta.sections) {
                await ensureSection(course.course_id, secName);
            }
        }

        // 2. Find Semester record
        const semKey = `${course.course_id}_${semNum}`;
        const semester = semesterMap.get(semKey);
        if (!semester) continue;

        // 3. Upsert Subject
        const subKey = `${course.course_id}_${semester.semester_id}_${cleanSubCode.toLowerCase()}`;
        const existingSubject = subjectMap.get(subKey);

        if (!existingSubject) {
            const newSub = await Subject.create({
                subject_code: cleanSubCode,
                subject_name: cleanSubName,
                course_id: course.course_id,
                semester_id: semester.semester_id,
                is_active: true
            });
            subjectMap.set(subKey, newSub);
        } else {
            if (existingSubject.subject_name !== cleanSubName) {
                await existingSubject.update({ subject_name: cleanSubName });
            }
        }

        countImported++;
    }

    console.log(`Successfully imported/updated ${countImported} subjects from CSV!`);
    return {
        success: true,
        message: `Successfully processed CSV and updated ${countImported} subjects.`,
        importedCount: countImported
    };
}

module.exports = { parseCSV, importSubjectsFromCSV };
