import React, { useState, useEffect, useMemo } from "react";
import { Download, ChevronDown, Loader2, Calendar, FileText, TableProperties, Eye, CheckCircle } from "lucide-react";
import api from "../../api/axiosInstance"; // Adjust the ../ as needed based on folder depth
import PageHeader from "./shared/PageHeader";

// Import the logo correctly for Vite/React
import davvLogo from "../../assets/image.png";

// Helper function to convert numbers to words (Indian Rupee Format)
function convertAmountToWords(amount) {
  if (!amount || amount === 0) return "Zero Rupees Only";
  
  const num = Math.floor(amount);
  const a = ['','One ','Two ','Three ','Four ', 'Five ','Six ','Seven ','Eight ','Nine ','Ten ','Eleven ','Twelve ','Thirteen ','Fourteen ','Fifteen ','Sixteen ','Seventeen ','Eighteen ','Nineteen '];
  const b = ['', '', 'Twenty ','Thirty ','Forty ','Fifty ', 'Sixty ','Seventy ','Eighty ','Ninety '];
  
  if (num.toString().length > 9) return 'Amount too large';
  
  const n = ('000000000' + num).slice(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!n) return '';
  
  let str = '';
  str += (n[1] != 0) ? (a[Number(n[1])] || b[n[1][0]] + a[n[1][1]]) + 'Crore ' : '';
  str += (n[2] != 0) ? (a[Number(n[2])] || b[n[2][0]] + a[n[2][1]]) + 'Lakh ' : '';
  str += (n[3] != 0) ? (a[Number(n[3])] || b[n[3][0]] + a[n[3][1]]) + 'Thousand ' : '';
  str += (n[4] != 0) ? (a[Number(n[4])] || b[n[4][0]] + a[n[4][1]]) + 'Hundred ' : '';
  str += (n[5] != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + a[n[5][1]]) : '';
  
  return str.trim() + " Rupees Only";
}

// Component to render UVFIN in boxes
const UVFINBlocks = ({ uvfin }) => {
  const chars = (uvfin || "").padEnd(15, " ").split("").slice(0, 15);
  return (
    <div className="flex">
      {chars.map((c, i) => (
        <div key={i} className="flex h-5 w-5 items-center justify-center border border-black text-xs font-bold uppercase sm:h-6 sm:w-6">
          {c.trim()}
        </div>
      ))}
    </div>
  );
};

// Accept an optional facultyUserId prop for Admin viewing
export default function ViewBill({ facultyUserId }) {
  const [records, setRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showFilter, setShowFilter] = useState(false);
  const [billPage, setBillPage] = useState(1);
  const [isFullDocumentView, setIsFullDocumentView] = useState(false);
  
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.toLocaleString('default', { month: 'long' }));
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  
  const [facultyInfo, setFacultyInfo] = useState({
    name: "Visiting Faculty",
    email: "",
    uvfin: "",
    course: "",
    semester: "",
    session: "2026-27",
    address: "",
    mobile: "",
    qualification: "",
    bankName: "",
    account: "",
    ifsc: "",
    pan: "",
    aadhaar: ""
  });

  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const years = [2024, 2025, 2026, 2027];

  // 1. Fetch static profile data using the new API
  const fetchFacultyProfile = async () => {
    try {
      const sessionStr = sessionStorage.getItem('iipsCurrentSession');
      if (!sessionStr) return;
      
      const session = JSON.parse(sessionStr);
      const targetId = facultyUserId || session.userId;

      const response = await api.get(`/admin/faculty/${targetId}`);

      if (response.data.success) {
        const data = response.data.data;
        setFacultyInfo(prev => ({
          ...prev,
          name: data.full_name || prev.name,
          email: data.email || prev.email,
          mobile: data.phone_number || prev.mobile,
          address: data.address || prev.address,
          qualification: data.qualification || prev.qualification,
          aadhaar: data.aadhaar_no || prev.aadhaar,
          account: data.account_no || prev.account,
          bankName: data.bank_name || prev.bankName,
          ifsc: data.ifsc_code || prev.ifsc,
          pan: data.pan_card_no || prev.pan,
          uvfin: data.uvfin || prev.uvfin,
        }));
      }
    } catch (error) {
      console.error("Error fetching faculty profile:", error);
    }
  };

  // 2. Fetch the attendance records
  const fetchMonthlyBill = async () => {
    setIsLoading(true);
    setShowFilter(false);
    try {
      const sessionStr = sessionStorage.getItem('iipsCurrentSession');
      if (!sessionStr) return;
      
      const session = JSON.parse(sessionStr);
      const targetId = facultyUserId || session.userId;

      const response = await api.get(`/attendance/monthly/${targetId}?month=${selectedMonth}&year=${selectedYear}`);

      if (response.data.success) {
        const data = response.data.data || [];
        setRecords(data);
        
        if (data.length > 0) {
          setFacultyInfo(prev => ({
            ...prev,
            course: data[0].course_name || prev.course,
            semester: data[0].semester_number ? `Semester ${data[0].semester_number}` : prev.semester,
          }));
        }
      }
    } catch (error) {
      console.error("Error fetching bill data:", error);
      setRecords([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFacultyProfile();
  }, [facultyUserId]);

  useEffect(() => {
    fetchMonthlyBill();
  }, [selectedMonth, selectedYear, facultyUserId]);

  // Filter out records that are marked as non-billable (exceeded 30k limit)
  const billableRecords = useMemo(() => {
    return records.filter(r => r.is_billable !== false && r.is_billable !== 0);
  }, [records]);

  const aggregatedRecords = useMemo(() => {
    const grouped = {};
    billableRecords.forEach(r => {
      const key = `${r.course_name}_${r.semester_number}_${r.subject_code}_${r.rate_per_hour}`;
      if (!grouped[key]) {
        grouped[key] = {
          program: r.course_name || facultyInfo.course,
          semester: r.semester_number ? `Semester ${r.semester_number}` : facultyInfo.semester,
          subject: `${r.subject_name} (${r.subject_code})`,
          rate: parseFloat(r.rate_per_hour || 0),
          dates: [],
          totalHrs: 0,
          amount: 0
        };
      }
      
      const d = new Date(r.attendance_date);
      const formattedDate = isNaN(d.getTime()) ? r.attendance_date : d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const hrs = parseFloat(r.hours);
      
      grouped[key].dates.push(`${formattedDate} (${hrs} Hrs)`);
      grouped[key].totalHrs += hrs;
      grouped[key].amount += (hrs * grouped[key].rate);
    });
    return Object.values(grouped);
  }, [billableRecords, facultyInfo.course, facultyInfo.semester]);

  const totalAmount = useMemo(() => {
    return aggregatedRecords.reduce((sum, r) => sum + r.amount, 0);
  }, [aggregatedRecords]);

  const totalHours = useMemo(() => {
    return aggregatedRecords.reduce((sum, r) => sum + r.totalHrs, 0);
  }, [aggregatedRecords]);

  const amountInWords = convertAmountToWords(totalAmount);
  const submissionDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const handleDownloadPDF = () => {
    setIsFullDocumentView(true);
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const monthShort = selectedMonth.substring(0, 3).toUpperCase();
  const billReferenceCode = `VFB/${selectedYear}/${monthShort}/001`;
  const excludedRecordsCount = records.length - billableRecords.length;

  return (
    <div className="pb-12 print:pb-0 print:bg-white">
      <style>
        {`
          @media print {
            @page { size: A4; margin: 10mm; }
            body * { visibility: hidden; }
            #printable-bill, #printable-bill * { visibility: visible; }
            #printable-bill {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              border: none !important;
              box-shadow: none !important;
            }
            /* NEW: Force body to collapse so hidden elements don't create blank pages */
            html, body { height: auto !important; min-height: auto !important; overflow: visible !important; }
            
            body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .print-hide { display: none !important; }
            .print-force-break { page-break-before: always; }
          }
        `}
      </style>

      <div className="print-hide">
        <PageHeader title="View Bill" subtitle="Official DAVV remuneration bill" />
      </div>

      <div className="px-4 py-6 sm:px-8 print:p-0">
        
        {/* TOP BAR WITH NEW FLEX LAYOUT */}
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 print-hide mb-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Document Preview</h2>
            <p className="mt-0.5 text-sm text-slate-500">Review the generated document before downloading.</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            {/* Download Button moved to the middle */}
            <button 
              disabled={billableRecords.length === 0}
              onClick={handleDownloadPDF}
              className="flex flex-1 sm:flex-none items-center justify-center gap-2 rounded-lg bg-[#004DD2] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className="h-4 w-4" /> Download PDF
            </button>

            <div className="relative flex-1 sm:flex-none">
              <button 
                onClick={() => setShowFilter(!showFilter)}
                className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
              >
                <Calendar className="h-4 w-4" /> 
                {selectedMonth} {selectedYear}
                <ChevronDown className="h-4 w-4" />
              </button>

              {showFilter && (
                <div className="absolute right-0 top-full z-10 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
                  <div className="space-y-4">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-500">Month</label>
                      <select 
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 p-2 text-sm outline-none focus:border-[#004DD2] focus:ring-1 focus:ring-[#004DD2]"
                      >
                        {months.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-500">Year</label>
                      <select 
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                        className="w-full rounded-lg border border-slate-300 p-2 text-sm outline-none focus:border-[#004DD2] focus:ring-1 focus:ring-[#004DD2]"
                      >
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                    </div>
                    <button 
                      onClick={fetchMonthlyBill}
                      className="w-full rounded-lg bg-[#004DD2] py-2 text-sm font-semibold text-white hover:bg-blue-800"
                    >
                      Apply Filter
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* MOBILE RESPONSIVE CARD VIEW */}
        <div className={`max-w-md mx-auto bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-5 print-hide ${isFullDocumentView ? 'hidden' : 'block lg:hidden'}`}>
          {excludedRecordsCount > 0 && (
            <div className="rounded-xl bg-orange-50 border border-orange-200 p-3 mb-4">
              <p className="text-xs font-semibold text-orange-800">Payment Cap Applied</p>
              <p className="text-[11px] text-orange-700 mt-1">
                {excludedRecordsCount} attendance session(s) were excluded from this bill as they exceed the ₹30,000 maximum limit.
              </p>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="px-3 py-1 bg-indigo-50 text-[#004DD2] text-xs font-semibold rounded-full">PREVIEW MODE</span>
            <span className="text-xs font-medium text-slate-500">{selectedMonth} {selectedYear}</span>
          </div>
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
            <p className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">Bill Reference</p>
            <p className="text-base font-bold text-slate-900 mt-0.5">{billReferenceCode}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase">Faculty Name & Email</p>
              <p className="text-sm font-semibold text-slate-800 mt-0.5 truncate">{facultyInfo.name}</p>
              <p className="text-xs text-slate-500 truncate">{facultyInfo.email || "No email provided"}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase">Total Billable Hours</p>
              <p className="text-sm font-semibold text-slate-800 mt-0.5">{totalHours} Hours</p>
            </div>
          </div>
          <div className="bg-blue-50/60 rounded-xl p-4 border border-blue-100 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-600">Total Amount</span>
            <span className="text-xl font-bold text-[#004DD2]">
              ₹{totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-900 h-36 flex items-center justify-center">
            <div className="absolute inset-0 opacity-40 bg-cover bg-center" style={{ backgroundImage: `url(${davvLogo})` }}></div>
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent"></div>
            <div className="relative z-10 text-center px-4">
              <CheckCircle className="h-6 w-6 text-blue-400 mx-auto mb-1" />
              <p className="text-xs font-semibold text-white">Verified by International Institute of Professional Studies</p>
            </div>
          </div>
          <div className="space-y-3 pt-2">
            <button 
              disabled={billableRecords.length === 0}
              onClick={handleDownloadPDF}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              <Download className="h-4 w-4" /> Download PDF
            </button>
            <button 
              onClick={() => setIsFullDocumentView(true)}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-50 py-3 text-sm font-semibold text-[#004DD2] hover:bg-blue-100 transition-colors"
            >
              <Eye className="h-4 w-4" /> View Full Bill
            </button>
          </div>
        </div>

        {/* FULL DESKTOP/DOCUMENT VIEW */}
        <div className={`mt-6 flex flex-col gap-6 lg:flex-row print:mt-0 print:block ${isFullDocumentView ? 'block' : 'hidden lg:flex'}`}>
          {isFullDocumentView && (
            <div className="print-hide mb-2">
              <button 
                onClick={() => setIsFullDocumentView(false)}
                className="text-xs font-semibold text-[#004DD2] hover:underline"
              >
                ← Back to Mobile Card View
              </button>
            </div>
          )}

          <div id="printable-bill" className="flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm print:overflow-visible mx-auto max-w-[210mm]">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-32 text-slate-500 print-hide">
                <Loader2 className="mb-3 h-8 w-8 animate-spin text-[#004DD2]" />
                <p>Generating official document...</p>
              </div>
            ) : billableRecords.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-32 text-center text-slate-500 print-hide">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-slate-100 bg-slate-50">
                  <Calendar className="h-8 w-8 text-slate-400" />
                </div>
                <p className="text-lg font-semibold text-slate-900">No Billable Records Found</p>
                <p className="mt-1 max-w-md">You have no marked attendance for {selectedMonth} {selectedYear}, or all marked sessions exceeded the ₹30,000 maximum limit.</p>
              </div>
            ) : (
              <div className="p-4 sm:p-8 print:p-0">
                
               {/* --- PAGE 1: ANNEXURE IV --- */}
                <div className={`mx-auto w-full min-h-[297mm] print:min-h-0 bg-white text-black print:block ${billPage === 1 ? 'block' : 'hidden'}`}>
                  <div className="text-[13px] leading-relaxed p-6">
                    <div className="relative mb-6 flex items-center justify-center min-h-[5rem]">
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 h-20 w-20">
                        <img src={davvLogo} alt="DAVV Logo" className="h-full w-full object-contain grayscale" />
                      </div>
                      <div className="text-center w-full px-24">
                        <p className="font-bold underline underline-offset-4 text-sm tracking-wide">ANNEXURE -IV</p>
                        <h1 className="mt-2 text-xl font-bold uppercase tracking-tight">DEVI AHILYA VISHWAVIDYALAYA, INDORE</h1>
                        <p className="mt-1 font-semibold text-[15px] leading-relaxed">
                          Department/School/Centre <span className="border-b border-black font-bold px-4 inline-block">International Institute of Professional Studies (IIPS)</span>
                        </p>
                      </div>
                    </div>

                    <div className="mb-4 flex justify-between font-semibold">
                      <p>Page No. of Attendance Register ___________________</p>
                      <p>S.No. ___________________</p>
                    </div>

                    <h2 className="mb-4 text-center text-[15px] font-bold underline underline-offset-4">
                      Bill For Claiming Remuneration/Honorarium for Visiting Faculty
                    </h2>

                    <div className="mb-6 flex items-center justify-end gap-2">
                      <span className="font-semibold">UVFIN (Unified Visiting Faculty ID No.)</span>
                      <UVFINBlocks uvfin={facultyInfo.uvfin} />
                    </div>

                    <div className="mb-6 space-y-4 text-[14px]">
                      <div className="flex items-end gap-2">
                        <span className="w-16 shrink-0 font-medium">Name</span>
                        <span className="flex-1 border-b border-black pb-0.5 text-left pl-2 font-semibold">{facultyInfo.name}</span>
                      </div>
                      <div className="flex items-end gap-2">
                        <span className="w-16 shrink-0 font-medium">Address</span>
                        <span className="flex-1 border-b border-black pb-0.5 text-left pl-2 font-semibold">{facultyInfo.address || "\u00A0"}</span>
                      </div>
                      <div className="flex items-end gap-4">
                        <div className="flex flex-1 items-end gap-2">
                          <span className="shrink-0 font-medium">Mob No.</span>
                          <span className="flex-1 border-b border-black pb-0.5 text-left pl-2 font-semibold">{facultyInfo.mobile || "\u00A0"}</span>
                        </div>
                        <div className="flex flex-1 items-end gap-2">
                          <span className="shrink-0 font-medium">Qualification</span>
                          <span className="flex-1 border-b border-black pb-0.5 text-left pl-2 font-semibold">{facultyInfo.qualification || "\u00A0"}</span>
                        </div>
                      </div>
                      <div className="flex items-end justify-between gap-2 text-[13px]">
                        <div className="flex items-end gap-2">
                          <span className="font-medium">Month</span>
                          <span className="w-20 border-b border-black pb-0.5 text-center font-bold">{selectedMonth}</span>
                        </div>
                        <div className="flex items-end gap-2">
                          <span className="font-medium">Year</span>
                          <span className="w-16 border-b border-black pb-0.5 text-center font-bold">{selectedYear}</span>
                        </div>
                        <div className="flex items-end gap-2">
                          <span className="font-medium">Date of Submission</span>
                          <span className="w-24 border-b border-black pb-0.5 text-center font-bold">{submissionDate}</span>
                        </div>
                        <div className="flex items-end gap-2">
                          <span className="font-medium">Theory/Practical</span>
                          <span className="w-20 border-b border-black pb-0.5 text-center font-bold">{totalHours}</span>
                          <span className="font-medium">per week</span>
                        </div>
                      </div>
                    </div>

              <table className="mb-2 w-full border-collapse border border-black text-center text-[11px]">
                <thead>
                  <tr>
                    <th className="border border-black py-[0.5mm] px-1 w-[12%] leading-tight">Program</th>
                    <th className="border border-black py-[0.5mm] px-1 w-[15%] leading-tight">Semester</th>
                    <th className="border border-black py-[0.5mm] px-1 w-[25%] leading-tight">Subject</th>
                    <th className="border border-black py-[0.5mm] px-1 w-[20%] leading-tight">Dates with<br/>Duration (Hrs.)</th>
                    <th className="border border-black py-[0.5mm] px-1 w-[8%] leading-tight">Total<br/>Hrs.</th>
                    <th className="border border-black py-[0.5mm] px-1 w-[10%] leading-tight">Rate</th>
                    <th className="border border-black py-[0.5mm] px-1 w-[10%] leading-tight">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {aggregatedRecords.map((r, index) => (
                    <tr key={index}>
                      {/* UPDATED: py-[0.1mm] applies exactly 0.1 millimeter padding vertically */}
                      <td className="border border-black py-[0.1mm] px-1 text-[11px] font-medium leading-tight">{r.program}</td>
                      <td className="border border-black py-[0.1mm] px-1 text-[11px] font-medium leading-tight">{r.semester}</td>
                      <td className="border border-black py-[0.1mm] px-1 text-[11px] font-medium leading-tight">{r.subject}</td>
                      <td className="border border-black py-[0.1mm] px-1 text-[10px] leading-tight text-slate-700">
                        {r.dates.map((dateStr, i) => (
                          <React.Fragment key={i}>
                            {dateStr}
                            {i < r.dates.length - 1 && <br />}
                          </React.Fragment>
                        ))}
                      </td>
                      <td className="border border-black py-[0.1mm] px-1 text-[11px] font-medium leading-tight">{r.totalHrs}</td>
                      <td className="border border-black py-[0.1mm] px-1 text-[11px] font-medium leading-tight">{r.rate}</td>
                      <td className="border border-black py-[0.1mm] px-1 text-[11px] font-medium leading-tight">{r.amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <p className="mb-3 text-[11px] font-medium">*Total amount should not exceed the maximum limit of remuneration for a month.</p>
              
              <div className="mb-4 flex items-end font-bold text-[14px]">
                <span>Total Hours</span>
                <span className="mx-2 w-16 border-b border-black text-center">{totalHours}</span>
                <span className="ml-4">Total Amount</span>
                <span className="mx-2 w-24 border-b border-black text-center">{totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                <span className="ml-4 font-normal">(Amount in Words</span>
                <span className="mx-2 flex-1 border-b border-black text-center">{amountInWords}</span>
                <span className="font-normal">)</span>
              </div>

              <div className="mb-4 text-[12px] font-medium leading-relaxed">
                <p className="font-bold underline text-[14px] mb-1">Note:</p>
                <ol className="list-[upper-alpha] pl-6 space-y-0.5">
                  <li>Rate of Remuneration will be as per university rules.</li>
                  <li>Faculty members are requested to complete all the above entries.</li>
                  <li>Rates to be verified as per visiting faculty attendance register and signed by authorized person.</li>
                  <li>Fill this form for theory/practical classes for every month.</li>
                  <li>Faculty should not be paid excess amount of Rs 30,000/- PM from D.A.V.V.</li>
                  <li>Verified visiting faculty Teaching attendance details should be attached with this bill.</li>
                </ol>
              </div>

              {/* REMOVED aggressive pageBreakInside from this outer div so it doesn't jump to Page 2 */}
              <div className="mb-4 text-center text-[12px]">
                <p className="mb-1 font-bold underline text-[15px]">UNDERTAKING</p>
                <p className="text-justify mb-4 font-medium leading-relaxed">
                  I was directed and permitted by the Head to engage the above Classes. For this I have submitted this bill. I therefore, request you to deduct _______% against Income Tax Returns from my payment. Further, I certify that total amount received per month doesn't exceed the maximum permissible limit of remuneration of any amount paid by D.A.V.V. which is Rs. 30,000/- at present.
                </p>
                
                {/* Kept pageBreakInside here so the signatures/bank details never split in half */}
                <div className="flex justify-between mt-4" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                        <div className="flex flex-col justify-between">
                          <div className="w-72 border-2 border-black p-3 text-left space-y-1.5 font-semibold text-[13px]">
                            <p>Pan Card No. <span className="border-b border-black inline-block w-40">{facultyInfo.pan}</span></p>
                            <p>A/c No. <span className="border-b border-black inline-block w-48">{facultyInfo.account}</span></p>
                            <p>Bank Name <span className="border-b border-black inline-block w-44">{facultyInfo.bankName}</span><br/><span className="text-[10px] font-normal italic">(State bank of India Compulsory)</span></p>
                            <p>IFSC Code <span className="border-b border-black inline-block w-44">{facultyInfo.ifsc}</span></p>
                            <p>Aadhaar No. <span className="border-b border-black inline-block w-40">{facultyInfo.aadhaar}</span></p>
                          </div>
                          
                          <div className="font-semibold space-y-2 text-[14px] mt-10">
                            <p>Date : {submissionDate}</p>
                            <p>Received Payments of Rs. <span className="font-bold underline underline-offset-4">{totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span></p>
                            <p>Cheque No. ____________</p>
                          </div>
                        </div>

                        <div className="flex flex-col justify-between items-center font-bold text-[12px] gap-8">
                          <div className="text-center mt-2">
                            <p>_____________________________________</p>
                            <p className="mt-1">Name & Signature of Visiting Faculty</p>
                          </div>
                          <div className="text-center">
                            <p>_____________________________________</p>
                            <p className="mt-1">Name & Signature of Batch Mentor</p>
                          </div>
                          <div className="text-center">
                            <p>_____________________________________</p>
                            <p className="mt-1">Verified by Coordinator (Name & Signature)</p>
                          </div>
                          <div className="text-center">
                            <p>_____________________________________</p>
                            <p className="mt-1">Signature Director/Head (Name & Seal)</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* --- PAGE 2: ATTENDANCE REGISTER --- */}
                <div className={`mx-auto w-full min-h-[297mm] print:min-h-0 bg-white text-black print:block print-force-break ${billPage === 2 ? 'block' : 'hidden'}`}>
                  <div className="text-[13px] leading-relaxed p-6 pt-12">
                    <div className="mb-8 flex items-center justify-end gap-2">
                      <span className="font-bold text-sm">UVFIN</span>
                      <UVFINBlocks uvfin={facultyInfo.uvfin} />
                    </div>

                    <div className="relative mb-8 flex items-center justify-center min-h-[5rem]">
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 h-20 w-20">
                        <img src={davvLogo} alt="DAVV Logo" className="h-full w-full object-contain grayscale" />
                      </div>
                      <div className="text-center w-full px-24">
                        <h1 className="text-xl font-bold uppercase tracking-tight">DEVI AHILYA VISHWAVIDYALAYA,</h1>
                        <h1 className="text-xl font-bold uppercase tracking-tight">INDORE</h1>
                        <p className="mt-3 text-[15px] font-semibold leading-relaxed">
                          Department/School/Centre <span className="border-b border-black font-bold px-12 inline-block">International Institute of Professional Studies (IIPS)</span>
                        </p>
                      </div>
                    </div>

                    <h2 className="mb-6 text-center text-[15px] font-bold underline underline-offset-4">
                      VISITING FACULTY TEACHING ATTENDANCE
                    </h2>

                    <table className="w-full border-collapse border-2 border-black font-semibold text-sm mb-0">
                      <tbody>
                        <tr>
                          <td className="border border-black p-2.5 w-1/2">Name: {facultyInfo.name}</td>
                          <td className="border border-black p-2.5 w-1/2">Designation : Visiting Faculty</td>
                        </tr>
                        <tr>
                          <td className="border border-black p-2.5">Month and Year : {selectedMonth} {selectedYear}</td>
                          {/* UPDATED: Semester text removed, showing only session */}
                          <td className="border border-black p-2.5">Session : {facultyInfo.session}</td>
                        </tr>
                      </tbody>
                    </table>
                    <table className="mb-4 w-full border-collapse border-2 border-t-0 border-black text-center text-[11px]">
                      <thead>
                        <tr>
                          <th className="border border-black py-[1mm] px-1 w-[15%] leading-tight">Date</th>
                          <th className="border border-black py-[1mm] px-1 w-[20%] leading-tight">Subject Code</th>
                          <th className="border border-black py-[1mm] px-1 text-left pl-2 w-[35%] leading-tight">Subject Name</th>
                          <th className="border border-black py-[1mm] px-1 w-[15%] leading-tight">Theory / Practice</th>
                          <th className="border border-black py-[1mm] px-1 w-[15%] leading-tight">Hours</th>
                        </tr>
                      </thead>
                      <tbody>
                        {billableRecords.map((r, i) => (
                          <tr key={i}>
                            {/* UPDATED: Ultra-minimal 0.1mm padding top/bottom to maximize rows per page */}
                            <td className="border border-black py-[0.1mm] px-1 text-[11px] leading-tight">{formatDate(r.attendance_date)}</td>
                            <td className="border border-black py-[0.1mm] px-1 text-[11px] font-semibold leading-tight">{r.subject_code}</td>
                            
                            <td className="border border-black py-[0.1mm] px-1 text-left pl-2 font-semibold text-[10px] leading-tight">
                              {r.subject_name}
                            </td>
                            
                            <td className="border border-black py-[0.1mm] px-1 text-[11px] leading-tight">{r.session_type || 'Theory'}</td>
                            <td className="border border-black py-[0.1mm] px-1 text-[11px] font-bold leading-tight">{parseFloat(r.hours)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* UPDATED: Shrunk margins and gap-10 to firmly anchor the signature to Page 2 */}
                    <div className="grid grid-cols-3 gap-4 font-bold text-[11px] whitespace-nowrap mt-4 px-2" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                      <div className="text-left">
                        <p>Name & Sign. of Visiting Faculty</p>
                      </div>
                      <div className="text-center">
                        <p>Name & Sign. of Program Incharge</p>
                      </div>
                      <div className="text-right flex flex-col gap-10">
                        <p>Name & Sign. of Batch Mentor</p>
                        <p>Name & Sign. of Director</p>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            )}
          </div>

          {/* PAGE TOGGLE BUTTONS */}
          <div className="flex flex-row lg:flex-col gap-2 shrink-0 justify-center print-hide">
            <button 
              onClick={() => setBillPage(1)}
              className={`flex flex-col items-center justify-center gap-1 w-20 h-20 rounded-xl border transition-all ${
                billPage === 1 
                  ? "border-[#004DD2] bg-blue-50 text-[#004DD2] shadow-sm" 
                  : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
              }`}
            >
              <FileText className="h-6 w-6" />
              <span className="text-xs font-semibold">Page 1</span>
            </button>
            <button 
              onClick={() => setBillPage(2)}
              className={`flex flex-col items-center justify-center gap-1 w-20 h-20 rounded-xl border transition-all ${
                billPage === 2 
                  ? "border-[#004DD2] bg-blue-50 text-[#004DD2] shadow-sm" 
                  : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
              }`}
            >
              <TableProperties className="h-6 w-6" />
              <span className="text-xs font-semibold">Page 2</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}