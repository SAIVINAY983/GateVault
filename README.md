# GateVault

**"Secure every parcel from gatehouse arrival to verified resident handover."**

GateVault is a comprehensive full-stack digital solution designed for large gated residential communities to manage courier and food deliveries efficiently. It digitizes the complete parcel lifecycle, establishing a verifiable digital chain of custody from the moment a parcel arrives at the security gate to its final handover to the resident.

## Problem Statement

Without a digital system, modern communities struggle to securely process the massive daily influx of courier deliveries. This leads to:
- **Gate congestion:** Multiple deliveries slow down entry and distract security staff.
- **Manual parcel records:** Paper-based registers are difficult to maintain and search.
- **Lost or misplaced parcels:** Packages are difficult to track once they reach the gatehouse.
- **Wrong handovers:** Without verification, parcels can be collected by the wrong person entirely.
- **Uncollected parcels:** Lack of visibility into which parcels have been waiting for days.
- **Lack of storage visibility:** Unknown shelf capacity leading to storage overflow.
- **Repeated resident queries:** Residents constantly contact security to check if their parcel has arrived.

## Solution / Workflow

GateVault creates a digital chain of custody:

**Courier Arrival → Guard Registers Parcel → Parcel ID + Secure PIN generated → Gatehouse Storage assigned → Resident Notification/View in Dashboard → PIN Verification → Handover → Digital History**

## Key Features

### Guard Workflow
- Fast parcel intake with Tower/Flat and Carrier selection
- Parcel identification and automatic generation of unique Parcel ID
- Storage/shelf assignment with capacity tracking
- Secure pickup verification via 4-digit PIN
- Parcel handover processing
- Overdue parcel tracking

### Resident Workflow
- Personal parcel dashboard
- Pending parcels visibility
- Secure pickup PIN/pass generation
- Real-time parcel status
- Collection history and audit log

### Admin Workflow
- Dashboard analytics (Total, Pending, Handed Over, Overdue)
- Storage capacity monitoring and visual utilization
- Carrier statistics and volume distribution
- Global parcel history log
- Overdue parcel monitoring
- Audit/transaction visibility

## User Roles

| Role | Permissions |
| :--- | :--- |
| **Admin** | View system analytics, monitor storage capacity, view global parcel history, track overdue parcels. |
| **Guard** | Register incoming parcels, assign shelves, verify resident PINs, confirm handovers, view pending gatehouse inventory. |
| **Resident** | View personal pending parcels, generate/view pickup PINs, view personal delivery history. |

## How the System Works

1. **Parcel Arrives:** A courier arrives at the gatehouse with a delivery.
2. **Guard Registers:** The Guard selects the destination Flat and Carrier, and assigns the parcel to an available Storage Shelf.
3. **Resident Gets PIN:** The system generates a unique `Parcel ID` and a secure 4-digit `Pickup PIN`. The Resident views this in their personal dashboard.
4. **PIN Verified:** When the Resident collects the parcel, they provide the `Parcel ID` and `Pickup PIN` to the Guard. The Guard enters this into the verification terminal.
5. **Parcel Handed Over:** Upon successful PIN verification, the Guard confirms the handover. The parcel is marked as `HANDED_OVER`.
6. **History Recorded:** The transaction is logged with timestamps, creating a digital audit trail accessible by the Admin and Resident.

## Screenshots

*(Screenshots will be added after final UI validation.)*

## System Architecture

React + Vite
↓
Axios / REST API
↓
Django REST Framework
↓
Django ORM
↓
MySQL

## Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React 19, Vite, React Router, Axios, Bootstrap 5, Recharts |
| **Backend** | Python 3, Django, Django REST Framework |
| **Database** | MySQL, Django ORM |
| **Authentication**| JWT (JSON Web Tokens) via `djangorestframework-simplejwt` |

## Project Structure

```text
GateVault/
├── backend/
│   ├── api/                 # Django app (Models, Views, Serializers, URLs)
│   ├── gatevault/           # Django project settings
│   ├── manage.py            # Django management script
│   ├── generate_demo_data.py# Script to populate demo data
│   └── requirements.txt     # Python dependencies
├── frontend/
│   ├── public/              # Static assets
│   ├── src/                 # React source code
│   │   ├── api/             # Axios instance setup
│   │   ├── components/      # Reusable UI components (Sidebar, ParcelCard, etc.)
│   │   ├── context/         # AuthContext
│   │   ├── layouts/         # AppLayout
│   │   ├── pages/           # Admin, Guard, Resident, and Landing pages
│   │   ├── App.jsx          # React router setup
│   │   ├── index.css        # Global styles and design system
│   │   └── main.jsx         # React entry point
│   ├── package.json         # Node dependencies
│   └── vite.config.js       # Vite configuration
├── setup_db.py              # MySQL database setup script
└── README.md                # Project documentation
```

## Database Design

- **User**: Custom user model extending `AbstractUser` with a `role` field (ADMIN, GUARD, RESIDENT).
- **Tower & Flat**: Represents the physical layout of the community. A `Flat` is linked to a `Tower`.
- **ResidentProfile & GuardProfile**: Links additional role-specific data to the `User` model.
- **Carrier**: Stores delivery carrier names (e.g., Amazon, FedEx).
- **StorageShelf**: Represents physical shelves in the gatehouse, tracking `capacity` and dynamically calculating `occupied` slots based on active parcels.
- **Parcel**: The core model tracking the delivery lifecycle. Contains foreign keys to `Flat`, `User` (Resident), `Carrier`, `StorageShelf`, and tracks timestamps (`received_at`, `handed_over_at`), `status` (AWAITING_PICKUP, OVERDUE, HANDED_OVER, CANCELLED), and the secure 4-digit `pickup_pin`.
- **PickupVerification**: Logs the timestamp and responsible `Guard` for every successful handover.

## API Documentation

| Method | Endpoint | Description | Access |
| :--- | :--- | :--- | :--- |
| POST | `/api/auth/login/` | Authenticate and obtain JWT tokens | Public |
| POST | `/api/auth/refresh/` | Refresh JWT access token | Public |
| GET | `/api/towers/` | List all towers | Authenticated |
| GET | `/api/flats/` | List flats (filterable by tower) | Authenticated |
| GET | `/api/carriers/` | List all carriers | Authenticated |
| GET | `/api/shelves/` | List all storage shelves and capacity | Authenticated |
| POST | `/api/parcels/intake/` | Register a new incoming parcel | Guard |
| GET | `/api/parcels/pending/` | List all pending gatehouse parcels | Guard |
| POST | `/api/parcels/<id>/verify/` | Verify a resident's pickup PIN | Guard |
| POST | `/api/parcels/<id>/handover/` | Confirm parcel handover | Guard |
| GET | `/api/resident/parcels/` | List a resident's parcels (pending & history) | Resident |
| GET | `/api/admin/dashboard/` | Get aggregated system analytics | Admin |
| GET | `/api/admin/overdue-parcels/`| List all overdue parcels (>48h) | Admin |
| GET | `/api/admin/parcel-history/` | View global parcel audit log | Admin |

## Security

- **JWT Authentication:** All API endpoints (except login) are secured using JSON Web Tokens.
- **Role-Based Access Control (RBAC):** Backend views enforce strict permission classes (e.g., `IsGuardUser`, `IsAdminUser`). Frontend routes are protected by `RoleBasedRoute`.
- **Resident Data Isolation:** Residents can only view parcels associated with their specific `Flat` and `User` account.
- **Secure PIN Verification:** Parcels cannot be handed over without the correct 4-digit PIN generated by the backend.
- **Environment Variables:** Sensitive configurations (Database credentials, Django Secret Key) are loaded from a `.env` file.

## Installation & Setup

### 1. Database Setup (MySQL)
Ensure MySQL is installed and running. Create the database using the provided setup script:
```bash
python setup_db.py
```

### 2. Backend Setup
Navigate to the backend directory and create a virtual environment:
```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Environment Configuration
Create a `.env` file in the `backend` directory (see Environment Variables section below).

### 4. Database Migrations & Demo Data
Apply Django migrations and generate realistic demo data:
```bash
python manage.py makemigrations api
python manage.py migrate
python generate_demo_data.py
```

### 5. Run Backend Server
```bash
python manage.py runserver
```

### 6. Frontend Setup
Open a new terminal, navigate to the frontend directory, install dependencies, and start the Vite dev server:
```bash
cd frontend
npm install
npm run dev
```

## Environment Variables

Create a `.env` file in the `backend/` directory:

```env
SECRET_KEY=django-insecure-your-secret-key-here
DEBUG=True
DB_NAME=gatevault
DB_USER=root
DB_PASSWORD=your_password
DB_HOST=localhost
DB_PORT=3306
```

## Demo Accounts

The `generate_demo_data.py` script provisions the following **Local Development Demo Credentials**:

| Role | Username | Password |
| :--- | :--- | :--- |
| **Admin** | `admin` | `admin123` |
| **Guard** | `guard1` | `guard123` |
| **Resident** | `resident1` | `resident123` |

## Demo Workflow

1. Guard logs in.
2. Guard registers an incoming parcel.
3. System generates a unique Parcel ID and secure 4-digit pickup PIN.
4. Parcel is assigned to available gatehouse storage.
5. Resident views the parcel in their dashboard.
6. Resident provides the Parcel ID and 4-digit pickup PIN during collection.
7. Guard verifies the credentials.
8. Guard confirms the handover.
9. Parcel status and timestamps are updated.
10. Admin can view updated analytics and parcel history.

## Testing

To manually test the application:
- **Authentication:** Verify that accessing protected routes without a token redirects to the login page.
- **Roles:** Verify that a Guard cannot access the Admin dashboard URL.
- **Parcel Intake:** Ensure assigning a parcel to a full shelf is prevented.
- **Resident Isolation:** Ensure `resident1` cannot see parcels belonging to other flats.
- **PIN Verification:** Attempt to verify a parcel with an incorrect 4-digit PIN. The system should reject it.
- **Storage Tracking:** Verify that handing over an `OVERDUE` or `AWAITING_PICKUP` parcel decreases the active occupancy of its assigned shelf.

## Future Enhancements

*(Not currently implemented)*
- QR code scanning for faster pickup verification.
- SMS/Email notifications upon parcel arrival.
- Barcode scanning for tracking numbers during intake.
- Native mobile application for Residents.
- Direct integration with Courier APIs (Amazon, FedEx).
- Advanced predictive analytics for storage forecasting.

## Limitations
- The system currently assumes a single guard is processing an individual transaction at a time; concurrent shelf capacity race conditions are not handled with strict database locks.
- Resident notifications are strictly pull-based (dashboard view) rather than push-based (no active WebSocket or email alerts).

## Contributors
- Member 1
- Member 2
- Member 3

## Project Status

GateVault is an actively developed full-stack project demonstrating secure parcel intake, storage tracking, resident verification, parcel handover, role-based access control, and administrative monitoring.

## License

This project is licensed under the MIT License.
