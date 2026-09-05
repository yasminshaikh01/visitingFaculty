# Frontend Integration Guide: Subject Groups Feature

This document details the newly added Subject Groups APIs and the modifications made to existing APIs. Frontend developers should use this guide to integrate the "Subject Groups" feature into the UI.

## Overview
A "Subject Group" allows multiple subjects within the same course and semester to be grouped together for shared faculty allocation. When subjects are grouped, they share a single `group_id` and generate a `combined_code` (e.g., `"CS-101 / IT-101"`).

---

## 1. New APIs for Managing Subject Groups

These APIs are accessible by users with the `super_admin` role.

### 1.1. Get All Subject Groups
Retrieves a list of all active subject groups along with their associated subjects.

- **Endpoint:** `GET /api/super_admin/subject-groups`
- **Headers:** `Authorization: Bearer <super_admin_token>`
- **Response Example (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "group_id": 1,
      "group_name": "Operating Systems Group",
      "combined_code": "CS-301 / IT-301",
      "is_active": true,
      "Subjects": [
        {
          "subject_id": 101,
          "subject_code": "CS-301",
          "subject_name": "Operating Systems - CS"
        },
        {
          "subject_id": 105,
          "subject_code": "IT-301",
          "subject_name": "Operating Systems - IT"
        }
      ]
    }
  ]
}
```

### 1.2. Create a Subject Group
Creates a new subject group and links it to existing subjects. **Note:** You must provide at least 2 `subject_ids`.

- **Endpoint:** `POST /api/super_admin/subject-groups`
- **Headers:** `Authorization: Bearer <super_admin_token>`, `Content-Type: application/json`
- **Request Body:**
```json
{
  "group_name": "Operating Systems Group",
  "combined_code": "CS-301 / IT-301",
  "subject_ids": [101, 105]
}
```
- **Response Example (200 OK):**
```json
{
  "success": true,
  "message": "Group created",
  "data": {
    "group_id": 1,
    "group_name": "Operating Systems Group",
    "combined_code": "CS-301 / IT-301",
    "is_active": true
  }
}
```

### 1.3. Delete a Subject Group
Deletes a group. The associated subjects are **not** deleted; they are simply unlinked from the group (their `group_id` is set to `null`).

- **Endpoint:** `DELETE /api/super_admin/subject-groups/:group_id`
- **Headers:** `Authorization: Bearer <super_admin_token>`
- **Response Example (200 OK):**
```json
{
  "success": true,
  "message": "Group removed, subjects unlinked"
}
```

---

## 2. Modified Existing APIs

The following existing APIs have been updated to include `group_id` and `combined_code` properties directly on the Subject or Allocation objects. This allows the frontend to easily display combined codes when a subject belongs to a group.

### 2.1. Admin: Get Subjects for Allocation
Used when selecting subjects in the Allocation Form.

- **Endpoint:** `GET /api/admin/courses/:courseId/semesters/:semesterId/subjects`
- **Modification:** The subject object now includes flattened group data.
- **Frontend Usage:** Check if `combined_code` exists. If it does, you can display `combined_code` instead of `subject_code` in the dropdown menu.
- **Response Example:**
```json
[
  {
    "subject_id": 101,
    "subject_code": "CS-301",
    "subject_name": "Operating Systems - CS",
    "group_id": 1,                     // NEW
    "group_name": "OS Group",          // NEW
    "combined_code": "CS-301 / IT-301" // NEW
  },
  {
    "subject_id": 102,
    "subject_code": "CS-302",
    "subject_name": "Databases",
    "group_id": null,                  // null if not in a group
    "group_name": null,
    "combined_code": null
  }
]
```

### 2.2. Admin: Get All Allocations
Used for displaying the Allocation Data Table.

- **Endpoint:** `GET /api/admin/allocations`
- **Modification:** The nested `Subject` object now includes a `SubjectGroup` relation.
- **Frontend Usage:** Access the combined code using `allocation.Subject.SubjectGroup?.combined_code`. If it exists, display the combined code; otherwise, fallback to `allocation.Subject.subject_code`.
- **Response Example Snippet:**
```json
{
  "allocation_id": 5,
  "Subject": {
    "subject_id": 101,
    "subject_code": "CS-301",
    "subject_name": "Operating Systems - CS",
    "group_id": 1,
    "SubjectGroup": {                  // NEW RELATION
      "combined_code": "CS-301 / IT-301",
      "group_name": "OS Group"
    }
  }
}
```

### 2.3. Super Admin: Show Semester Subjects
Used in the Course Dashboard when viewing subjects in a specific semester.

- **Endpoint:** `GET /api/super_admin/subjects/:course_id/:semester_number`
- **Modification:** The subject objects now include flattened `group_id` and `combined_code`.
- **Frontend Usage:** In the subjects table, you can add a column or a visual indicator for "Group".
- **Response Example Snippet:**
```json
[
  {
    "subject_id": 101,
    "subject_code": "CS-301",
    "subject_name": "Operating Systems - CS",
    "group_id": 1,                     // NEW
    "combined_code": "CS-301 / IT-301" // NEW
  }
]
```

---

## Recommended Frontend Implementation Steps

1. **Subject Groups Management Page (Super Admin):**
   - Create a new UI page or tab for Super Admins to manage groups.
   - Use `GET /api/super_admin/subject-groups` to populate a table of existing groups.
   - Add a form with a multi-select dropdown (fetching subjects) to `POST /api/super_admin/subject-groups`. Ensure the user selects at least 2 subjects.
   - Add a "Delete" button on each row that triggers `DELETE /api/super_admin/subject-groups/:group_id`.

2. **Allocation Form Dropdown (Admin):**
   - When mapping the response from `GET /api/admin/courses/:courseId/semesters/:semesterId/subjects` to the dropdown options, check if `combined_code` is present.
   - Example label rendering logic: `subject.combined_code ? subject.combined_code : subject.subject_code`.

3. **Allocations Data Table (Admin):**
   - When displaying the "Subject Code" column in the table mapped from `GET /api/admin/allocations`, check for the `SubjectGroup` relation.
   - Example table cell logic: `row.Subject.SubjectGroup?.combined_code || row.Subject.subject_code`.
