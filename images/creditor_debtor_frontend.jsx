/*
Updated Creditor & Debtor Backend with Amortization & Export
File: creditor-debtor-backend.js

This is an extended version of the previous backend. Changes include:
- Added endpoint to compute/generate amortization schedules: GET /loans/:id/amortization
- On loan approval, we compute and store monthly_installment (unchanged) and support detailed schedule retrieval
- Reporting export endpoint: GET /reports/export?format=csv|pdf which returns CSV or PDF of payments (supports optional from/to query)
- Added new dependencies: pdfkit, csv-stringify (or we implement CSV by hand)

Run:
npm install express better-sqlite3 jsonwebtoken bcryptjs body-parser uuid pdfkit

*/

const express = require('express');
const bodyParser = require('body-parser');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const PDFDocument = require('pdfkit');

const app = express();
app.use(bodyParser.json());

const DB_FILE = './app.db';
const db = new Database(DB_FILE);
const JWT_SECRET = process.env.JWT_SECRET || 'replace_this_with_env_secret';
const PORT = process.env.PORT || 3000;

// ------------------ DB Setup ------------------
function initDb() {
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin','creditor','debtor')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS creditors (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE NOT NULL,
      company TEXT,
      phone TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS debtors (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE NOT NULL,
      national_id TEXT,
      phone TEXT,
      address TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS loans (
      id TEXT PRIMARY KEY,
      debtor_id TEXT NOT NULL,
      creditor_id TEXT NOT NULL,
      principal REAL NOT NULL,
      interest_rate REAL NOT NULL,
      term_months INTEGER NOT NULL,
      start_date DATE,
      status TEXT NOT NULL CHECK(status IN ('pending','approved','rejected','active','closed')),
      monthly_installment REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(debtor_id) REFERENCES debtors(id),
      FOREIGN KEY(creditor_id) REFERENCES creditors(id)
    );

    CREATE TABLE IF NOT EXISTS repayments (
      id TEXT PRIMARY KEY,
      loan_id TEXT NOT NULL,
      amount REAL NOT NULL,
      paid_on DATE DEFAULT CURRENT_TIMESTAMP,
      method TEXT,
      note TEXT,
      FOREIGN KEY(loan_id) REFERENCES loans(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      action TEXT,
      payload TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const row = db.prepare('SELECT COUNT(*) AS c FROM users').get();
  if (row.c === 0) seedSampleData();
}

function seedSampleData() {
  console.log('Seeding sample data...');
  const now = new Date().toISOString();

  const insertUser = db.prepare('INSERT INTO users (id,name,email,password,role,created_at) VALUES (?,?,?,?,?,?)');
  const insertCreditor = db.prepare('INSERT INTO creditors (id,user_id,company,phone) VALUES (?,?,?,?)');
  const insertDebtor = db.prepare('INSERT INTO debtors (id,user_id,national_id,phone,address) VALUES (?,?,?,?,?)');

  const adminId = uuidv4();
  const adminPwd = bcrypt.hashSync('adminpass', 8);
  insertUser.run(adminId, 'UETCL Admin', 'admin@uetcl.local', adminPwd, 'creditor', now);
  insertCreditor.run(uuidv4(), adminId, 'Uganda Electricity Co', '+256700000001');

  const debtor1 = uuidv4();
  const debtor1Pwd = bcrypt.hashSync('debtor1', 8);
  insertUser.run(debtor1, 'Alice Debtor', 'alice@example.com', debtor1Pwd, 'debtor', now);
  insertDebtor.run(uuidv4(), debtor1, 'NIN-001', '+256700000002', 'Kampala');

  const debtor2 = uuidv4();
  const debtor2Pwd = bcrypt.hashSync('debtor2', 8);
  insertUser.run(debtor2, 'Bob Debtor', 'bob@example.com', debtor2Pwd, 'debtor', now);
  insertDebtor.run(uuidv4(), debtor2, 'NIN-002', '+256700000003', 'Entebbe');

  const creditorRow = db.prepare('SELECT id FROM creditors LIMIT 1').get();
  const aliceRow = db.prepare('SELECT d.id as debtor_id, u.email FROM debtors d JOIN users u ON d.user_id = u.id WHERE u.email = ?').get('alice@example.com');
  const loanId = uuidv4();
  const insertLoan = db.prepare('INSERT INTO loans (id,debtor_id,creditor_id,principal,interest_rate,term_months,start_date,status,monthly_installment) VALUES (?,?,?,?,?,?,?,?,?)');
  insertLoan.run(loanId, aliceRow.debtor_id, creditorRow.id, 1000.00, 12.0, 12, null, 'pending', null);

  console.log('Seeding complete. Admin login: admin@uetcl.local / adminpass');
  console.log('Sample debtors: alice@example.com / debtor1  , bob@example.com / debtor2');
}

initDb();

// ------------------ Helpers & Middleware ------------------
function signToken(payload) { return jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' }); }

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing token' });
  const token = auth.slice(7);
  try { const payload = jwt.verify(token, JWT_SECRET); req.user = payload; next(); } catch (e) { return res.status(401).json({ error: 'Invalid token' }); }
}

function roleMiddleware(roles) { return (req, res, next) => { if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' }); next(); }; }

function audit(action, payload) { const stmt = db.prepare('INSERT INTO audit_log (id,action,payload) VALUES (?,?,?)'); stmt.run(uuidv4(), action, JSON.stringify(payload)); }

// ------------------ Auth Routes ------------------
app.post('/auth/register', (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password || !role) return res.status(400).json({ error: 'Missing fields' });
  if (!['creditor','debtor','admin'].includes(role)) return res.status(400).json({ error: 'Invalid role' });

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(400).json({ error: 'Email exists' });

  const id = uuidv4();
  const pwd = bcrypt.hashSync(password, 8);
  db.prepare('INSERT INTO users (id,name,email,password,role) VALUES (?,?,?,?,?)').run(id, name, email, pwd, role);

  if (role === 'creditor') db.prepare('INSERT INTO creditors (id,user_id,company,phone) VALUES (?,?,?,?)').run(uuidv4(), id, '', '');
  if (role === 'debtor') db.prepare('INSERT INTO debtors (id,user_id,national_id,phone,address) VALUES (?,?,?,?,?)').run(uuidv4(), id, '', '', '');

  audit('register', { id, name, email, role });
  res.json({ message: 'Registered' });
});

app.post('/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Missing credentials' });
  const user = db.prepare('SELECT id,name,email,password,role FROM users WHERE email = ?').get(email);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const ok = bcrypt.compareSync(password, user.password);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

  const token = signToken({ id: user.id, name: user.name, email: user.email, role: user.role });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

// ------------------ Creditor & Debtor Management ------------------
app.get('/creditors', authMiddleware, roleMiddleware(['admin','creditor']), (req, res) => { const rows = db.prepare('SELECT c.id, u.name, u.email, c.company, c.phone FROM creditors c JOIN users u ON c.user_id = u.id').all(); res.json(rows); });
app.put('/creditors/:id', authMiddleware, roleMiddleware(['admin','creditor']), (req, res) => { const id = req.params.id; const { company, phone } = req.body; const creditor = db.prepare('SELECT * FROM creditors WHERE id = ?').get(id); if (!creditor) return res.status(404).json({ error: 'Not found' }); if (req.user.role === 'creditor') { const own = db.prepare('SELECT user_id FROM creditors WHERE id = ?').get(id); if (!own || own.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' }); } db.prepare('UPDATE creditors SET company = ?, phone = ? WHERE id = ?').run(company || creditor.company, phone || creditor.phone, id); audit('update_creditor', { id, by: req.user.id }); res.json({ message: 'updated' }); });

app.post('/debtors', authMiddleware, roleMiddleware(['admin','creditor']), (req, res) => { const { name, email, password, national_id, phone, address } = req.body; if (!name || !email || !password) return res.status(400).json({ error: 'Missing fields' }); const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email); if (existing) return res.status(400).json({ error: 'Email exists' }); const uid = uuidv4(); const pwd = bcrypt.hashSync(password, 8); db.prepare('INSERT INTO users (id,name,email,password,role) VALUES (?,?,?,?,?)').run(uid, name, email, pwd, 'debtor'); const did = uuidv4(); db.prepare('INSERT INTO debtors (id,user_id,national_id,phone,address) VALUES (?,?,?,?,?)').run(did, uid, national_id || '', phone || '', address || ''); audit('create_debtor', { uid, did, by: req.user.id }); res.json({ message: 'debtor created', debtor_id: did }); });

app.get('/debtors', authMiddleware, roleMiddleware(['admin','creditor']), (req, res) => { const rows = db.prepare('SELECT d.id, u.name, u.email, d.national_id, d.phone, d.address FROM debtors d JOIN users u ON d.user_id = u.id').all(); res.json(rows); });
app.get('/debtors/:id', authMiddleware, roleMiddleware(['admin','creditor','debtor']), (req, res) => { const id = req.params.id; if (req.user.role === 'debtor') { const record = db.prepare('SELECT d.id FROM debtors d JOIN users u ON d.user_id = u.id WHERE u.id = ?').get(req.user.id); if (!record || record.id !== id) return res.status(403).json({ error: 'Forbidden' }); } const row = db.prepare('SELECT d.id, u.name, u.email, d.national_id, d.phone, d.address FROM debtors d JOIN users u ON d.user_id = u.id WHERE d.id = ?').get(id); if (!row) return res.status(404).json({ error: 'Not found' }); res.json(row); });

// ------------------ Loans ------------------
app.post('/loans', authMiddleware, roleMiddleware(['creditor']), (req, res) => {
  const { debtor_id, principal, interest_rate, term_months, start_date } = req.body;
  if (!debtor_id || !principal || !interest_rate || !term_months) return res.status(400).json({ error: 'Missing fields' });
  const creditor = db.prepare('SELECT id FROM creditors WHERE user_id = ?').get(req.user.id);
  if (!creditor) return res.status(403).json({ error: 'Creditor profile not found' });
  const id = uuidv4();
  db.prepare('INSERT INTO loans (id,debtor_id,creditor_id,principal,interest_rate,term_months,start_date,status,monthly_installment) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(id, debtor_id, creditor.id, principal, interest_rate, term_months, start_date || null, 'pending', null);
  audit('create_loan', { id, by: req.user.id });
  res.json({ message: 'loan created', loan_id: id });
});

// Approve/reject loan
app.post('/loans/:id/decision', authMiddleware, roleMiddleware(['creditor','admin']), (req, res) => {
  const id = req.params.id; const { action } = req.body; if (!['approve','reject'].includes(action)) return res.status(400).json({ error: 'Invalid action' });
  const loan = db.prepare('SELECT * FROM loans WHERE id = ?').get(id); if (!loan) return res.status(404).json({ error: 'Loan not found' });
  if (req.user.role === 'creditor') { const creditor = db.prepare('SELECT id FROM creditors WHERE user_id = ?').get(req.user.id); if (!creditor || creditor.id !== loan.creditor_id) return res.status(403).json({ error: 'Forbidden' }); }
  if (action === 'reject') { db.prepare('UPDATE loans SET status = ? WHERE id = ?').run('rejected', id); audit('loan_rejected', { id, by: req.user.id }); return res.json({ message: 'loan rejected' }); }

  // Approve: compute monthly installment using amortization formula with monthly compounding
  const P = loan.principal; const annualRate = loan.interest_rate; const n = loan.term_months;
  const r = annualRate / 100 / 12; // monthly rate
  let monthly = null;
  if (r === 0) monthly = P / n; else monthly = (P * r) / (1 - Math.pow(1 + r, -n));

  db.prepare('UPDATE loans SET status = ?, start_date = DATE(\'now\'), monthly_installment = ? WHERE id = ?').run('active', monthly, id);
  audit('loan_approved', { id, by: req.user.id, monthly });
  res.json({ message: 'loan approved', monthly_installment: monthly });
});

app.get('/loans', authMiddleware, (req, res) => {
  if (req.user.role === 'creditor') { const creditor = db.prepare('SELECT id FROM creditors WHERE user_id = ?').get(req.user.id); const rows = db.prepare('SELECT l.*, u.name as debtor_name FROM loans l JOIN debtors d ON l.debtor_id = d.id JOIN users u ON d.user_id = u.id WHERE l.creditor_id = ?').all(creditor.id); return res.json(rows); }
  if (req.user.role === 'debtor') { const debtor = db.prepare('SELECT id FROM debtors WHERE user_id = ?').get(req.user.id); const rows = db.prepare('SELECT l.*, u.name as creditor_name FROM loans l JOIN creditors c ON l.creditor_id = c.id JOIN users u ON c.user_id = u.id WHERE l.debtor_id = ?').all(debtor.id); return res.json(rows); }
  const rows = db.prepare('SELECT l.*, d.id as debtor_id, du.name as debtor_name, c.id as creditor_id, cu.name as creditor_name FROM loans l JOIN debtors d ON l.debtor_id = d.id JOIN users du ON d.user_id = du.id JOIN creditors c ON l.creditor_id = c.id JOIN users cu ON c.user_id = cu.id').all(); res.json(rows);
});

app.get('/loans/:id', authMiddleware, (req, res) => {
  const id = req.params.id;
  const loan = db.prepare('SELECT l.*, du.name AS debtor_name, cu.name AS creditor_name FROM loans l JOIN debtors d ON l.debtor_id = d.id JOIN users du ON d.user_id = du.id JOIN creditors c ON l.creditor_id = c.id JOIN users cu ON c.user_id = cu.id WHERE l.id = ?').get(id);
  if (!loan) return res.status(404).json({ error: 'Loan not found' });
  if (req.user.role === 'debtor') { const debtor = db.prepare('SELECT id FROM debtors WHERE user_id = ?').get(req.user.id); if (!debtor || debtor.id !== loan.debtor_id) return res.status(403).json({ error: 'Forbidden' }); }
  if (req.user.role === 'creditor') { const creditor = db.prepare('SELECT id FROM creditors WHERE user_id = ?').get(req.user.id); if (!creditor || creditor.id !== loan.creditor_id) return res.status(403).json({ error: 'Forbidden' }); }
  const repayments = db.prepare('SELECT * FROM repayments WHERE loan_id = ? ORDER BY paid_on DESC').all(id);
  const paid = repayments.reduce((s, r) => s + r.amount, 0);
  const totalDue = (loan.monthly_installment ? loan.monthly_installment * loan.term_months : loan.principal);
  const outstanding = totalDue - paid;
  res.json({ loan, repayments, paid, outstanding });
});

// ------------------ Amortization endpoint ------------------
function computeAmortization(principal, annualRate, months, monthlyPayment = null) {
  const schedule = [];
  const r = annualRate / 100 / 12;
  let monthly = monthlyPayment;
  if (!monthly) {
    if (r === 0) monthly = principal / months; else monthly = (principal * r) / (1 - Math.pow(1 + r, -months));
  }
  let balance = principal;
  for (let m = 1; m <= months; m++) {
    const interest = balance * r;
    let principalPaid = monthly - interest;
    // Guard against final rounding
    if (m === months) principalPaid = balance;
    balance = Math.max(0, balance - principalPaid);
    schedule.push({ month: m, payment: parseFloat(monthly.toFixed(2)), principal: parseFloat(principalPaid.toFixed(2)), interest: parseFloat(interest.toFixed(2)), balance: parseFloat(balance.toFixed(2)) });
  }
  return schedule;
}

app.get('/loans/:id/amortization', authMiddleware, (req, res) => {
  const id = req.params.id;
  const loan = db.prepare('SELECT * FROM loans WHERE id = ?').get(id);
  if (!loan) return res.status(404).json({ error: 'Loan not found' });
  // permissions
  if (req.user.role === 'debtor') { const debtor = db.prepare('SELECT id FROM debtors WHERE user_id = ?').get(req.user.id); if (!debtor || debtor.id !== loan.debtor_id) return res.status(403).json({ error: 'Forbidden' }); }
  if (req.user.role === 'creditor') { const creditor = db.prepare('SELECT id FROM creditors WHERE user_id = ?').get(req.user.id); if (!creditor || creditor.id !== loan.creditor_id) return res.status(403).json({ error: 'Forbidden' }); }
  const schedule = computeAmortization(loan.principal, loan.interest_rate, loan.term_months, loan.monthly_installment);
  res.json({ schedule });
});

// ------------------ Repayments ------------------
app.post('/loans/:id/repay', authMiddleware, roleMiddleware(['debtor']), (req, res) => {
  const id = req.params.id; const { amount, method, note } = req.body; if (!amount) return res.status(400).json({ error: 'Missing amount' });
  const loan = db.prepare('SELECT * FROM loans WHERE id = ?').get(id); if (!loan) return res.status(404).json({ error: 'Loan not found' });
  const debtor = db.prepare('SELECT id FROM debtors WHERE user_id = ?').get(req.user.id); if (!debtor || debtor.id !== loan.debtor_id) return res.status(403).json({ error: 'Forbidden' });
  const rid = uuidv4(); db.prepare('INSERT INTO repayments (id,loan_id,amount,method,note) VALUES (?,?,?,?,?)').run(rid, id, amount, method || '', note || ''); audit('repayment', { id: rid, loan_id: id, amount, by: req.user.id });
  const repayments = db.prepare('SELECT SUM(amount) as s FROM repayments WHERE loan_id = ?').get(id); const paid = repayments.s || 0; const totalDue = (loan.monthly_installment ? loan.monthly_installment * loan.term_months : loan.principal);
  if (paid + 0.0001 >= totalDue) { db.prepare('UPDATE loans SET status = ? WHERE id = ?').run('closed', id); audit('loan_closed', { loan_id: id }); }
  res.json({ message: 'repayment recorded', repayment_id: rid });
});

// ------------------ Dashboard & Reporting ------------------
app.get('/dashboard', authMiddleware, (req, res) => {
  if (req.user.role === 'creditor') {
    const creditor = db.prepare('SELECT id FROM creditors WHERE user_id = ?').get(req.user.id);
    const totalLoans = db.prepare('SELECT COUNT(*) as c FROM loans WHERE creditor_id = ?').get(creditor.id).c;
    const activeLoans = db.prepare("SELECT COUNT(*) as c FROM loans WHERE creditor_id = ? AND status = 'active'").get(creditor.id).c;
    const pending = db.prepare("SELECT COUNT(*) as c FROM loans WHERE creditor_id = ? AND status = 'pending'").get(creditor.id).c;
    const totalOutstanding = db.prepare('SELECT SUM((monthly_installment*term_months)) as s FROM loans WHERE creditor_id = ? AND status IN ("active","pending")').get(creditor.id).s || 0;
    return res.json({ totalLoans, activeLoans, pending, totalOutstanding });
  }
  if (req.user.role === 'debtor') {
    const debtor = db.prepare('SELECT id FROM debtors WHERE user_id = ?').get(req.user.id);
    const myLoans = db.prepare('SELECT COUNT(*) as c FROM loans WHERE debtor_id = ?').get(debtor.id).c;
    const active = db.prepare("SELECT COUNT(*) as c FROM loans WHERE debtor_id = ? AND status = 'active'").get(debtor.id).c;
    const outstanding = db.prepare('SELECT SUM((monthly_installment*term_months)) as s FROM loans WHERE debtor_id = ? AND status = "active"').get(debtor.id).s || 0;
    return res.json({ myLoans, active, outstanding });
  }
  const totalCreditors = db.prepare('SELECT COUNT(*) as c FROM creditors').get().c;
  const totalDebtors = db.prepare('SELECT COUNT(*) as c FROM debtors').get().c;
  const totalLoans = db.prepare('SELECT COUNT(*) as c FROM loans').get().c;
  const totalOutstanding = db.prepare('SELECT SUM((monthly_installment*term_months)) as s FROM loans WHERE status = "active"').get().s || 0;
  res.json({ totalCreditors, totalDebtors, totalLoans, totalOutstanding });
});

app.get('/reports/late', authMiddleware, roleMiddleware(['admin','creditor']), (req, res) => {
  const creditorId = (req.user.role === 'creditor') ? db.prepare('SELECT id FROM creditors WHERE user_id = ?').get(req.user.id).id : null;
  const loans = db.prepare('SELECT l.*, c.id as creditor_id, cu.name as creditor_name FROM loans l JOIN creditors c ON l.creditor_id = c.id JOIN users cu ON c.user_id = cu.id WHERE l.status = "active"').all();
  const late = [];
  loans.forEach(l => {
    if (creditorId && l.creditor_id !== creditorId) return;
    if (!l.start_date) return;
    const start = new Date(l.start_date);
    const now = new Date();
    const monthsElapsed = Math.floor((now.getFullYear()-start.getFullYear())*12 + (now.getMonth()-start.getMonth()));
    const expectedPaid = (l.monthly_installment || 0) * monthsElapsed;
    const rep = db.prepare('SELECT SUM(amount) as s FROM repayments WHERE loan_id = ?').get(l.id);
    const paid = rep.s || 0;
    const deficit = expectedPaid - paid;
    if (deficit > 0.01) { late.push({ loan_id: l.id, debtor_id: l.debtor_id, creditor_name: l.creditor_name, monthsElapsed, expectedPaid, paid, deficit }); }
  });
  res.json({ late });
});

// Payments report (raw)
app.get('/reports/payments', authMiddleware, roleMiddleware(['admin','creditor']), (req, res) => {
  const { from, to } = req.query;
  let stmt;
  if (from && to) stmt = db.prepare('SELECT p.*, l.debtor_id, du.name as debtor_name FROM repayments p JOIN loans l ON p.loan_id = l.id JOIN debtors d ON l.debtor_id = d.id JOIN users du ON d.user_id = du.id WHERE date(p.paid_on) BETWEEN date(?) AND date(?) ORDER BY p.paid_on DESC');
  else stmt = db.prepare('SELECT p.*, l.debtor_id, du.name as debtor_name FROM repayments p JOIN loans l ON p.loan_id = l.id JOIN debtors d ON l.debtor_id = d.id JOIN users du ON d.user_id = du.id ORDER BY p.paid_on DESC LIMIT 500');
  const rows = (from && to) ? stmt.all(from, to) : stmt.all();
  res.json({ rows });
});

// ------------------ Export (CSV / PDF) ------------------
app.get('/reports/export', authMiddleware, roleMiddleware(['admin','creditor']), (req, res) => {
  const { from, to, format } = req.query;
  const fmt = (format || 'csv').toLowerCase();
  let stmt;
  if (from && to) stmt = db.prepare('SELECT p.*, l.debtor_id, du.name as debtor_name FROM repayments p JOIN loans l ON p.loan_id = l.id JOIN debtors d ON l.debtor_id = d.id JOIN users du ON d.user_id = du.id WHERE date(p.paid_on) BETWEEN date(?) AND date(?) ORDER BY p.paid_on DESC');
  else stmt = db.prepare('SELECT p.*, l.debtor_id, du.name as debtor_name FROM repayments p JOIN loans l ON p.loan_id = l.id JOIN debtors d ON l.debtor_id = d.id JOIN users du ON d.user_id = du.id ORDER BY p.paid_on DESC LIMIT 500');
  const rows = (from && to) ? stmt.all(from, to) : stmt.all();

  if (fmt === 'csv') {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="payments-report.csv"');
    // simple CSV
    res.write('paid_on,repayment_id,loan_id,debtor_id,debtor_name,amount,method,note
');
    rows.forEach(r => {
      const line = `${r.paid_on},${r.id},${r.loan_id},${r.debtor_id},"${(r.debtor_name||'').replace(/"/g,'""')}",${r.amount},"${(r.method||'')}","${(r.note||'')}"
`;
      res.write(line);
    });
    res.end();
    return;
  }

  if (fmt === 'pdf') {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="payments-report.pdf"');
    const doc = new PDFDocument({ margin: 30, size: 'A4' });
    doc.pipe(res);
    doc.fontSize(14).text('Payments Report', { align: 'center' });
    doc.moveDown();
    rows.forEach(r => {
      doc.fontSize(10).text(`${r.paid_on} | ${r.loan_id} | ${r.debtor_name} | ${r.amount} | ${r.method || ''}`);
    });
    doc.end();
    return;
  }

  res.status(400).json({ error: 'Unsupported format' });
});

// ------------------ Debtor endpoints ------------------
app.get('/me/loans', authMiddleware, roleMiddleware(['debtor']), (req, res) => { const debtor = db.prepare('SELECT id FROM debtors WHERE user_id = ?').get(req.user.id); const rows = db.prepare('SELECT l.*, cu.name as creditor_name FROM loans l JOIN creditors c ON l.creditor_id = c.id JOIN users cu ON c.user_id = cu.id WHERE l.debtor_id = ?').all(debtor.id); res.json(rows); });
app.get('/me/loans/:id/payments', authMiddleware, roleMiddleware(['debtor']), (req, res) => { const loanId = req.params.id; const debtor = db.prepare('SELECT id FROM debtors WHERE user_id = ?').get(req.user.id); const loan = db.prepare('SELECT * FROM loans WHERE id = ?').get(loanId); if (!loan) return res.status(404).json({ error: 'Loan not found' }); if (loan.debtor_id !== debtor.id) return res.status(403).json({ error: 'Forbidden' }); const rows = db.prepare('SELECT * FROM repayments WHERE loan_id = ? ORDER BY paid_on DESC').all(loanId); res.json(rows); });

app.get('/', (req, res) => res.send('Creditors-Debtors Backend Running (Extended)'));

app.listen(PORT, () => { console.log(`Server listening on http://localhost:${PORT}`); });
