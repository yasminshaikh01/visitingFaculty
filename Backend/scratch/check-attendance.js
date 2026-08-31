const { Attendance, Allocation, User } = require("../src/Schema");

async function check() {
    try {
        const records = await Attendance.findAll({
            include: [{ model: Allocation }]
        });
        console.log(`Total attendance records: ${records.length}`);
        records.forEach(r => {
            console.log(`ID: ${r.attendance_id}, User: ${r.user_id}, Date: ${r.attendance_date}, Month: ${r.month}, Year: ${r.year}, Hours: ${r.hours}, Rate: ${r.Allocation?.rate_per_hour}, IsBillable: ${r.is_billable}`);
        });
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

check();
