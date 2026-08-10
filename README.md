# Unified Visiting Faculty Management — IIPS, DAVV

A full-stack MERN application for managing visiting faculty at the Institute of Information Technology (IIPS), Devi Ahilya Vishwavidyalaya (DAVV). The system streamlines faculty onboarding, lecture/session logging, and bill generation through role-based approval workflows for **Super Admin**, **Admin**, and **Faculty** users.

🔗 **Live demo:** [visiting-faculty.vercel.app](https://visiting-faculty.vercel.app)

---

## ✨ Features

- **Role-based access control** — separate dashboards and permissions for Super Admin, Admin, and Faculty roles
- **JWT authentication** — secure login and protected routes across the app
- **Faculty approval workflows** — request submission, admin/superadmin review, and real-time status updates
- **Document uploads** — resumes, certificates, and supporting documents handled via Multer
- **Automated bill generation** — PDF bills/invoices generated with PDFKit
- **Email notifications** — automated status and approval emails via Nodemailer
- **Real-time state management** — approval and workflow states sync instantly across faculty and admin views

---

## 🛠 Tech Stack

**Frontend**
- React
- Axios (API communication)
- React Router (role-based routing)

**Backend**
- Node.js
- Express.js
- MongoDB (Mongoose)
- JSON Web Tokens (JWT) for authentication
- Multer for file uploads
- PDFKit for bill/document generation
- Nodemailer for email notifications

**Deployment**
- Frontend hosted on Vercel

---

## 📁 Project Structure

```
visitingFaculty/
├── Backend/          # Express server, REST API, MongoDB models, auth & mailing logic
├── Frontend/          # React client with role-based dashboards
├── package.json
└── .gitignore
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v16+ recommended)
- npm or yarn
- A MongoDB instance (local or Atlas)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yasminshaikh01/visitingFaculty.git
   cd visitingFaculty
   ```

2. **Set up the backend**
   ```bash
   cd Backend
   npm install
   ```
   Create a `.env` file in the `Backend` directory with the required environment variables, for example:
   ```env
   PORT=5000
   MONGO_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret
   EMAIL_USER=your_email
   EMAIL_PASS=your_email_app_password
   ```
   Start the backend server:
   ```bash
   npm start
   ```

3. **Set up the frontend**
   ```bash
   cd ../Frontend
   npm install
   npm start
   ```

4. The app should now be running locally, with the frontend typically at `http://localhost:3000` and the backend API at `http://localhost:5000`.

---

## 👥 User Roles

| Role | Capabilities |
|------|--------------|
| **Super Admin** | Full system oversight, manages admins and final approvals |
| **Admin** | Reviews and processes faculty requests, manages sessions/bills |
| **Faculty** | Submits requests, tracks approval status, views generated bills |

---

## 📌 Notes

- This project is actively maintained as part of the IIPS, DAVV faculty management workflow.
- Environment variables and secrets are required for full functionality and are **not** included in this repository.

---

## 📄 License

This project currently has no explicit license. Please contact the repository owner for usage permissions.
