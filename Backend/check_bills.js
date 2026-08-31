require("dotenv").config();
require("./src/Schema");
const { Bill, User, BillDetail } = require("./src/Schema");
const seq = require("./src/config/database");

(async () => {
  await seq.authenticate();
  const bills = await Bill.findAll({
    where: { month: "August", year: 2026 },
    include: [
      { model: User, attributes: ["full_name", "uvfin"] },
      { model: BillDetail }
    ]
  });
  console.log("Bills found:", bills.length);
  bills.forEach(b =>
    console.log(
      `bill_id=${b.bill_id}, user=${b.User?.full_name}, amount=${b.total_amount}, details=${b.BillDetails?.length}`
    )
  );
  await seq.close();
})();
