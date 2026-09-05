# 🚀 Revive

> AI-Powered Payment Recovery & Merchant Communication Platform

Revive is a full-stack payment recovery platform designed to help businesses recover failed or pending customer payments through intelligent, automated and personalized communication.

The platform provides a merchant dashboard where businesses can monitor recovery cases, manage payment recovery, communicate with customers, configure recovery strategies, and analyze recovery performance.

---

## ✨ Key Features

### 🔐 Authentication

- Merchant Registration
- Merchant Login
- JWT-based authentication
- Protected backend routes
- Merchant profile management
- Password hashing using bcrypt
- Automatic dashboard redirection after authentication

### 💳 Payment Recovery

- Payment recovery management
- Recovery case tracking
- Recovery status management
- Automated recovery workflows
- Recovery scheduling
- Recovery configuration

### 🤝 Customer Communication

- Automated recovery messages
- Email communication
- WhatsApp communication architecture
- Customer-specific communication preferences
- Personalized messages based on customer memory
- Multiple languages including:
  - English
  - Hindi
  - Hinglish
- Multiple communication tones:
  - Friendly
  - Direct
  - Formal

### 🧠 Customer Memory

Revive maintains customer communication preferences such as:

- Preferred communication channel
- Preferred language
- Preferred tone
- Reliability score
- Important customer notes

This allows the recovery system to generate more personalized communication.

### 🤖 AI Conversation

The platform supports customer conversations through the conversation service.

Customer messages can be processed based on:

- Recovery case
- Customer message
- Communication channel
- Customer context

### 📊 Analytics & Business Intelligence

The dashboard includes functionality for:

- ROI analysis
- Recovery simulation
- Recovery performance
- Payment information
- Recovery configuration
- Communication monitoring

### 🛡️ Recovery Guardrails

Revive includes safeguards to prevent excessive automated communication.

Examples:

- Stop communication after successful recovery
- Stop communication after manual escalation
- Stop communication when recovery is explicitly stopped
- Limit automated communication attempts

The current communication guardrail allows a maximum of:

`3 automated communication attempts`

---

# 🏗️ System Architecture

Revive follows a full-stack architecture consisting of a React frontend, Node.js/Express backend, MongoDB database and external communication/payment services.

flowchart TB

User["👤 Merchant / User"]

Frontend["🖥️ Revive Console Frontend<br/>React + Vite"]

Router["🌐 React Router"]

    AuthUI["🔐 Login / Register"]
    Dashboard["📊 Dashboard"]
    RecoveryUI["💳 Recovery"]
PaymentUI["💰 Payment"]
CommunicationUI["💬 Communication"]
PromiseUI["🤝 Promise Recovery"]
VoiceUI["📞 Voice"]
SimulationUI["🧪 Simulation"]
ROIUI["📈 ROI"]

    Backend["⚙️ Revive Backend<br/>Node.js + Express"]

    AuthRoutes["🔐 Auth Routes"]
    PaymentRoutes["💳 Payment Routes"]
    RecoveryRoutes["♻️ Recovery Routes"]
    CommunicationRoutes["💬 Communication Routes"]
    PromiseRoutes["🤝 Promise Routes"]
    VoiceRoutes["📞 Voice Routes"]
    SimulationRoutes["🧪 Simulation Routes"]
    ROIRoutes["📈 ROI Routes"]
    RecoveryConfigRoutes["⚙️ Recovery Config Routes"]

    Controllers["🎮 Controllers"]

    Services["🧠 Business Services"]

    RecoveryEngine["Recovery Engine"]
    RecoveryScheduler["Recovery Scheduler"]
    RecoveryService["Recovery Service"]
    CommunicationService["Communication Service"]
    ConversationService["Conversation Service"]
    NegotiationService["Negotiation Service"]
    ROIService["ROI Service"]
    SimulationService["Simulation Service"]
    VoiceAgentService["Voice Agent Service"]

    Database["🍃 MongoDB"]

    Merchant["Merchant"]
    RecoveryCase["Recovery Case"]
    CustomerMemory["Customer Memory"]
    AuditLog["Audit Logs"]

    External["🌍 External Services"]

    Razorpay["💳 Razorpay"]
    Resend["📧 Resend"]
    Twilio["📱 Twilio"]

    User --> Frontend
    Frontend --> Router

    Router --> AuthUI
    Router --> Dashboard
    Router --> RecoveryUI
    Router --> PaymentUI
    Router --> CommunicationUI
    Router --> PromiseUI
    Router --> VoiceUI
    Router --> SimulationUI
    Router --> ROIUI

    Frontend -->|"REST API / JSON"| Backend

    Backend --> AuthRoutes
    Backend --> PaymentRoutes
    Backend --> RecoveryRoutes
    Backend --> CommunicationRoutes
    Backend --> PromiseRoutes
    Backend --> VoiceRoutes
    Backend --> SimulationRoutes
    Backend --> ROIRoutes
    Backend --> RecoveryConfigRoutes

    AuthRoutes --> Controllers
    PaymentRoutes --> Controllers
    RecoveryRoutes --> Controllers
    CommunicationRoutes --> Controllers
    PromiseRoutes --> Controllers
    VoiceRoutes --> Controllers
    SimulationRoutes --> Controllers
    ROIRoutes --> Controllers
    RecoveryConfigRoutes --> Controllers

    Controllers --> Services

    Services --> RecoveryEngine
    Services --> RecoveryScheduler
    Services --> RecoveryService
    Services --> CommunicationService
    Services --> ConversationService
    Services --> NegotiationService
    Services --> ROIService
    Services --> SimulationService
    Services --> VoiceAgentService

    Services --> Database

    Database --> Merchant
    Database --> RecoveryCase
    Database --> CustomerMemory
    Database --> AuditLog

    PaymentRoutes --> Razorpay
    CommunicationService --> Resend
    CommunicationService --> Twilio
🔑 Environment Variables

Sensitive credentials should NOT be committed to GitHub.

Create a .env file inside the backend/server directory.

Example:

PORT=5000

MONGO_URI=your_mongodb_connection_string

JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=7d

RESEND_API_KEY=your_resend_api_key
EMAIL_FROM=your_email

TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone_number

For the frontend, create a .env file if required:

🚀 Installation & Setup
1. Clone the Repository
git clone https://github.com/priyas1672/Revive.git
cd Revive


2. Setup Backend

Go inside the server directory:

cd server

Install dependencies:

npm install

Create your .env file:

server/.env

Add the required environment variables.

Start the backend:

npm run dev

The backend runs on:

http://localhost:5000
3. Setup Frontend

Open another terminal.

Go to the frontend directory:

cd Revive-Console-Frontend

Install dependencies:

npm install

Create the frontend .env file:

Revive-Console-Frontend/.env

Add:

VITE_API_URL=http://localhost:5000/api

Start the frontend:

npm run dev

The frontend will be available at the Vite development URL.
