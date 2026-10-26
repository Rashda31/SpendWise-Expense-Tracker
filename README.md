# SpendWise — Personal Finance Tracker

SpendWise is a responsive, client-side personal finance tracker built using **HTML5, CSS3, and Vanilla JavaScript**. It helps users manage their income, expenses, monthly budgets, and savings through an interactive dashboard.

The application includes demo registration and login, profile management, transaction tracking, and light and dark themes. All data is stored locally in the browser without requiring a backend or database server.

## Features

### 1. User Registration & Login

* Register demo accounts with duplicate email prevention.
* Validate registration and login forms.
* Show or hide passwords.
* Generate salted SHA-256 password hashes using the Web Crypto API.
* Maintain user sessions using browser storage.

### 2. Personalized Dashboard

* Display a personalized greeting.
* View total income, expenses, and net balance.
* Display financial information in Indian Rupees (₹).

### 3. Profile Management

* Update name, email, and monthly budget targets.
* Reflect profile changes in the dashboard.

### 4. Transaction Management

* Add, edit, and delete transactions.
* Organize transactions by category.
* Search, filter, and sort transactions.
* Maintain separate transaction records for each user.

### 5. Financial Overview

* Track all-time income, expenses, and net balance.
* Review monthly income, expenses, and net cash flow.
* Calculate the monthly savings rate.

### 6. Additional Features

* Persistent light and dark themes.
* Responsive design for desktop, tablet, and mobile.
* Legacy transaction migration from supported earlier versions.

## Technologies Used

* **HTML5** — Page structure.
* **CSS3** — Styling and responsive layouts.
* **Vanilla JavaScript** — Application logic and interactivity.
* **Web Crypto API** — Password hashing.
* **LocalStorage** — Local data persistence.

## Project Structure

```text
SpendWise/
├── index.html
├── register.html
├── register.css
├── register.js
├── login.html
├── login.css
├── login.js
├── dashboard.html
├── dashboard.css
├── dashboard.js
└── README.md
```

## Getting Started

**Prerequisites:** A modern web browser, Visual Studio Code, and the Live Server extension (recommended).

1. Clone or download the repository.
2. Open the project folder in Visual Studio Code.
3. Run `index.html` using Live Server.
4. Register a demo account and log in to start tracking your finances.

## Data Storage

SpendWise stores demo accounts, password hashes, sessions, transactions, profile settings, and theme preferences in browser storage.

Data is browser-specific and may be lost if browser storage is cleared. It does not automatically synchronize across devices.

## Security & Limitations

SpendWise is a frontend demonstration project, not a production banking application. Client-side authentication and SHA-256 hashing do not provide production-level security. Browser storage can be inspected or modified, and the application has no backend or database.

## Future Improvements

* Backend authentication and database integration.
* Spending charts and category-wise analytics.
* CSV export and transaction import.
* Budget alerts and savings goals.

## Project Purpose

SpendWise demonstrates practical frontend development skills, including DOM manipulation, form validation, CRUD operations, browser storage, filtering, sorting, and responsive design.
