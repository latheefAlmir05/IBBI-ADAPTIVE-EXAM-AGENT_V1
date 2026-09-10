const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'ibbi_exam.db'));

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initDB() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE,
      created_at INTEGER DEFAULT (strftime('%s','now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      created_at INTEGER DEFAULT (strftime('%s','now'))
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER DEFAULT (strftime('%s','now'))
    );

    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      topic TEXT NOT NULL,
      subtopic TEXT,
      difficulty INTEGER DEFAULT 1,
      type TEXT DEFAULT 'mcq',
      question TEXT NOT NULL,
      option_a TEXT,
      option_b TEXT,
      option_c TEXT,
      option_d TEXT,
      correct_answer TEXT NOT NULL,
      explanation TEXT,
      marks INTEGER DEFAULT 1,
      tags TEXT
    );

    CREATE TABLE IF NOT EXISTS attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      question_id INTEGER,
      mock_id TEXT,
      selected_answer TEXT,
      is_correct INTEGER,
      marks_earned REAL,
      time_taken INTEGER,
      topic TEXT,
      subtopic TEXT,
      difficulty INTEGER,
      error_type TEXT,
      created_at INTEGER DEFAULT (strftime('%s','now'))
    );

    CREATE TABLE IF NOT EXISTS mocks (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      type TEXT DEFAULT 'full',
      status TEXT DEFAULT 'active',
      questions TEXT NOT NULL,
      answers TEXT DEFAULT '{}',
      start_time INTEGER,
      end_time INTEGER,
      duration INTEGER DEFAULT 7200,
      total_marks REAL DEFAULT 0,
      max_marks REAL DEFAULT 100,
      created_at INTEGER DEFAULT (strftime('%s','now'))
    );

    CREATE TABLE IF NOT EXISTS weak_areas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      topic TEXT NOT NULL,
      subtopic TEXT,
      weakness_type TEXT,
      score REAL DEFAULT 0,
      attempts INTEGER DEFAULT 0,
      correct INTEGER DEFAULT 0,
      consecutive_errors INTEGER DEFAULT 0,
      last_updated INTEGER DEFAULT (strftime('%s','now'))
    );

    CREATE TABLE IF NOT EXISTS case_laws (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_name TEXT NOT NULL,
      court TEXT,
      year INTEGER,
      citation TEXT,
      facts TEXT,
      issue TEXT,
      provisions TEXT,
      judgment TEXT,
      outcome TEXT,
      exam_principle TEXT,
      topic TEXT
    );

    CREATE TABLE IF NOT EXISTS case_studies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      scenario TEXT NOT NULL,
      topic TEXT,
      difficulty INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS case_study_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_study_id INTEGER NOT NULL,
      question TEXT NOT NULL,
      option_a TEXT,
      option_b TEXT,
      option_c TEXT,
      option_d TEXT,
      correct_answer TEXT NOT NULL,
      explanation TEXT,
      marks INTEGER DEFAULT 4,
      FOREIGN KEY(case_study_id) REFERENCES case_studies(id)
    );

    CREATE TABLE IF NOT EXISTS study_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      topic TEXT NOT NULL,
      subtopic TEXT,
      status TEXT DEFAULT 'not_started',
      last_studied INTEGER,
      UNIQUE(session_id, topic, subtopic)
    );
  `);

  seedData();
}

function seedData() {
  const count = db.prepare('SELECT COUNT(*) as c FROM questions').get();
  if (count.c > 0) return;

  // Seed questions
  const insertQ = db.prepare(`
    INSERT INTO questions (topic, subtopic, difficulty, type, question, option_a, option_b, option_c, option_d, correct_answer, explanation, marks, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const questions = [
    // IBC - Section 7 (CIRP by Financial Creditor)
    ['IBC', 'CIRP Initiation', 1, 'mcq', 'Under Section 7 of IBC 2016, who can initiate CIRP against a corporate debtor?',
     'Operational Creditor', 'Financial Creditor', 'Resolution Applicant', 'Liquidator',
     'B', 'Section 7 of IBC allows a Financial Creditor (alone or jointly with other financial creditors) to file an application before NCLT to initiate CIRP when a default has occurred.', 1, 'IBC,CIRP,Section7'],

    ['IBC', 'CIRP Initiation', 1, 'mcq', 'What is the minimum default amount required to initiate CIRP under IBC 2016 as amended?',
     'Rs. 1 Lakh', 'Rs. 10 Lakhs', 'Rs. 1 Crore', 'Rs. 5 Lakhs',
     'C', 'The minimum threshold for default to initiate CIRP was raised to Rs. 1 Crore by notification dated 24 March 2020.', 1, 'IBC,CIRP,Default'],

    ['IBC', 'Moratorium', 2, 'mcq', 'Under Section 14 of IBC, moratorium is declared by:',
     'Resolution Professional', 'Committee of Creditors', 'NCLT', 'IBBI',
     'C', 'Section 14 of IBC provides that on admission of application under Section 7/9/10, NCLT shall declare a moratorium prohibiting institution of suits, enforcement of security interest, recovery of property etc.', 1, 'IBC,Moratorium,Section14'],

    ['IBC', 'Committee of Creditors', 2, 'mcq', 'The voting threshold for approval of a Resolution Plan by the Committee of Creditors is:',
     '51%', '66%', '75%', '90%',
     'C', 'As per Section 30(4) of IBC, the CoC shall approve the resolution plan by a vote of not less than 66% of voting share of financial creditors.', 1, 'IBC,CoC,ResolutionPlan'],

    ['IBC', 'Liquidation', 2, 'mcq', 'Under IBC, which creditor has the HIGHEST priority in liquidation waterfall?',
     'Financial Creditors', 'Operational Creditors', 'Insolvency Resolution Process Costs', 'Secured Creditors',
     'C', 'Section 53 of IBC prescribes the waterfall: (1) CIRP costs, (2) Secured creditors/workmen dues (24 months), (3) Other employee dues (12 months), (4) Unsecured financial creditors, (5) Government dues, (6) Remaining secured creditors, (7) Remaining operational/other creditors, (8) Equity shareholders.', 1, 'IBC,Liquidation,Section53,Waterfall'],

    ['IBC', 'CIRP Initiation', 1, 'mcq', 'Under Section 8 of IBC, an operational creditor must send a demand notice to the corporate debtor and wait for how many days before filing an application?',
     '15 days', '30 days', '45 days', '60 days',
     'B', 'Section 8(1) of IBC requires an operational creditor to first deliver a demand notice of unpaid operational debt to the corporate debtor and wait for 30 days before filing an application under Section 9.', 1, 'IBC,CIRP,Section8'],

    ['IBC', 'Resolution Professional', 2, 'mcq', 'The Interim Resolution Professional (IRP) must convene the first meeting of Committee of Creditors within how many days of his appointment?',
     '7 days', '14 days', '21 days', '30 days',
     'B', 'As per Regulation 25 of IBBI (CIRP) Regulations, the IRP must convene the first meeting of CoC within 14 days of his appointment.', 1, 'IBC,IRP,CoC,Regulations'],

    ['IBC', 'Resolution Plan', 3, 'mcq', 'A resolution plan must provide for payment of at least what percentage of liquidation value to dissenting financial creditors?',
     '50%', '66%', '75%', '100%',
     'C', 'As per Section 30(2)(b) of IBC, a resolution plan must provide for payment of at least liquidation value to dissenting financial creditors, as per Supreme Court judgment in Essar Steel case.', 1, 'IBC,ResolutionPlan,DissentingCreditors'],

    ['IBC', 'Cross-border Insolvency', 2, 'mcq', 'Which part of IBC deals with cross-border insolvency?',
     'Part I', 'Part II', 'Part III', 'Part IV',
     'B', 'Part II of IBC (Sections 234-245) deals with cross-border insolvency and is based on UNCITRAL Model Law on Cross-Border Insolvency.', 1, 'IBC,CrossBorder,PartII'],

    ['IBC', 'Voluntary Liquidation', 2, 'mcq', 'Under Section 59 of IBC, voluntary liquidation can be initiated by corporate debtor when:',
     'Default has occurred', 'Company is unable to pay debts', 'Members pass special resolution', 'NCLT orders liquidation',
     'C', 'Section 59 of IBC provides that a corporate debtor may initiate voluntary liquidation when members pass a special resolution to that effect, subject to conditions.', 1, 'IBC,VoluntaryLiquidation,Section59'],

    ['IBC', 'Fast Track CIRP', 1, 'mcq', 'Fast Track Corporate Insolvency Resolution Process (FTCIRP) has a timeline of:',
     '90 days', '120 days', '180 days', '330 days',
     'A', 'Section 55 of IBC provides for Fast Track CIRP with a timeline of 90 days from insolvency commencement date, which can be extended by 45 days (total 135 days).', 1, 'IBC,FTCIRP,Timeline'],

    ['IBC', 'IP Registration', 1, 'mcq', 'Which entity registers Insolvency Professionals under IBC?',
     'IBBI', 'NCLT', 'IPA', 'RBI',
     'A', 'IBBI maintains the register of Insolvency Professionals. An IP must be enrolled with an Insolvency Professional Agency (IPA) and registered with IBBI.', 1, 'IBC,IP,Registration,IBBI'],

    ['IBC', 'CoC Composition', 2, 'mcq', 'Operational creditors are members of Committee of Creditors:',
     'Always', 'Never', 'Only if there are no financial creditors', 'Only in liquidation',
     'C', 'Section 21(2) of IBC provides that operational creditors shall be members of CoC only if there are no financial creditors in the corporate debtor.', 1, 'IBC,CoC,OperationalCreditors'],

    ['IBC', 'Resolution Applicant', 2, 'mcq', 'Section 29A of IBC deals with:',
     'Eligibility of resolution applicants', 'Powers of Resolution Professional', 'Committee of Creditors', 'Liquidation process',
     'A', 'Section 29A of IBC specifies eligibility criteria for resolution applicants, including disqualifications related to NPA accounts, wilful defaulters, etc.', 1, 'IBC,ResolutionApplicant,Section29A'],

    ['IBC', 'Liquidator', 2, 'mcq', 'Who appoints the Liquidator in case of liquidation under IBC?',
     'IBBI', 'NCLT', 'Committee of Creditors', 'Resolution Professional',
     'B', 'Section 34 of IBC provides that NCLT shall appoint a Liquidator for liquidation process of corporate debtor. The Liquidator must be registered with IBBI.', 1, 'IBC,Liquidator,Appointment,Section34'],

    // Rules & Regulations
    ['Rules & Regulations', 'IP Regulations', 1, 'mcq', 'Under IBBI (Insolvency Professionals) Regulations 2016, an IP must be a member of which entity?',
     'IBBI directly', 'Insolvency Professional Agency (IPA)', 'NCLT', 'Reserve Bank of India',
     'B', 'Under Regulation 3 of IBBI (IP) Regulations 2016, a person must be enrolled as a member of an IPA and registered with IBBI to act as an Insolvency Professional.', 1, 'Regulations,IP,IPA'],

    ['Rules & Regulations', 'CIRP Regulations', 2, 'mcq', 'The CIRP period under IBC is:',
     '180 days only', '270 days only', '180 days extendable to 270 days, with 330 days as outer limit', '365 days',
     'C', 'Section 12 of IBC: CIRP shall be completed in 180 days. NCLT may extend by 90 days (total 270 days). The overall outer limit including litigation is 330 days per Section 12(3).', 1, 'IBC,CIRP,Timeline'],

    ['Rules & Regulations', 'Liquidation Regulations', 2, 'mcq', 'Under IBBI (Liquidation Process) Regulations, a Public Announcement in liquidation must be made within how many days of appointment of Liquidator?',
     '3 days', '5 days', '7 days', '15 days',
     'B', 'Regulation 12 of IBBI (Liquidation Process) Regulations 2016 requires the liquidator to make a public announcement within 5 days of his appointment.', 1, 'Regulations,Liquidation,PublicAnnouncement'],

    ['Rules & Regulations', 'IP Regulations', 1, 'mcq', 'An Insolvency Professional must register with IBBI within how many days of enrollment with IPA?',
     '30 days', '60 days', '90 days', '180 days',
     'A', 'Under Regulation 5 of IBBI (IP) Regulations, an enrolled member of IPA must apply for registration with IBBI within 30 days of enrollment.', 1, 'Regulations,IP,Registration'],

    ['Rules & Regulations', 'CIRP Regulations', 2, 'mcq', 'Under IBBI (CIRP) Regulations, the IRP must prepare Information Memorandum within how many days?',
     '7 days', '14 days', '21 days', '30 days',
     'B', 'Regulation 36 of IBBI (CIRP) Regulations requires the IRP to prepare Information Memorandum within 14 days of his appointment.', 1, 'Regulations,CIRP,InformationMemorandum'],

    ['Rules & Regulations', 'Liquidation Regulations', 2, 'mcq', 'The Liquidator must prepare the liquidation estate account within how many days of liquidation commencement?',
     '30 days', '60 days', '75 days', '90 days',
     'C', 'Regulation 32 of IBBI (Liquidation Process) Regulations requires the Liquidator to prepare liquidation estate account within 75 days of liquidation commencement date.', 1, 'Regulations,Liquidation,EstateAccount'],

    ['Rules & Regulations', 'Voluntary Liquidation Regulations', 1, 'mcq', 'Under IBBI (Voluntary Liquidation) Regulations, the Insolvency Professional must file the final report with NCLT within how many days of completion of voluntary liquidation?',
     '7 days', '15 days', '30 days', '45 days',
     'C', 'Regulation 13 of IBBI (Voluntary Liquidation) Regulations requires the IP to file final report with NCLT within 30 days of completion of voluntary liquidation process.', 1, 'Regulations,VoluntaryLiquidation,FinalReport'],

    ['Rules & Regulations', 'Grievance Regulations', 1, 'mcq', 'Under IBBI (Grievance Redressal) Regulations, a grievance can be filed against:',
     'IBBI only', 'IPs and IPAs only', 'IBBI, IPs, IPAs and Registered Valuers', 'Only against NCLT orders',
     'C', 'IBBI (Grievance Redressal) Regulations provide for filing grievances against IBBI, Insolvency Professionals, Insolvency Professional Agencies and Registered Valuers.', 1, 'Regulations,GrievanceRedressal,Scope'],

    ['Rules & Regulations', 'Pre-Pack Regulations', 2, 'mcq', 'Under IBBI (Pre-Packaged Insolvency Resolution Process) Regulations, the base resolution plan must be submitted by the prospective resolution applicant:',
     'Before admission of CIRP application', 'After IRP appointment', 'During CIRP', 'At CoC meeting',
     'A', 'Pre-Pack Regulations require the prospective resolution applicant to submit base resolution plan along with the CIRP application under Section 7 for MSMEs.', 1, 'Regulations,PrePack,BasePlan'],

    // Business Laws
    ['Business Laws', 'Companies Act', 1, 'mcq', 'Under the Companies Act 2013, a "small company" means a company whose paid-up share capital does not exceed:',
     'Rs. 1 Crore', 'Rs. 2 Crore', 'Rs. 4 Crore', 'Rs. 10 Crore',
     'C', 'As per Section 2(85) of Companies Act 2013 (amended), a small company has paid-up capital not exceeding Rs. 4 Crore and turnover not exceeding Rs. 40 Crore.', 1, 'BusinessLaws,CompaniesAct,SmallCompany'],

    ['Business Laws', 'Contract Act', 1, 'mcq', 'An agreement without consideration is void EXCEPT when:',
     'It is in writing', 'It is between close relatives', 'It is made out of love and affection between near relatives and is in writing and registered', 'Both A and B',
     'C', 'Section 25 of the Indian Contract Act 1872 lists exceptions to the rule that agreements without consideration are void. One exception is: agreement expressed in writing and registered made on account of natural love and affection between parties standing in near relation to each other.', 1, 'BusinessLaws,ContractAct,Consideration'],

    ['Business Laws', 'Companies Act', 2, 'mcq', 'Under Companies Act 2013, the maximum number of directors in a public company is:',
     '10', '12', '15', 'No limit',
     'C', 'Section 149(1) of Companies Act 2013 provides that a public company must have at least 3 directors and maximum 15 directors. This can be increased by special resolution.', 1, 'BusinessLaws,CompaniesAct,Directors'],

    ['Business Laws', 'Contract Act', 2, 'mcq', 'A contract is voidable when:',
     'Both parties consent', 'Consent is obtained through coercion, undue influence, fraud or misrepresentation', 'It is oral', 'It is for illegal consideration',
     'B', 'Section 19 of Indian Contract Act 1872 provides that when consent to an agreement is obtained through coercion, undue influence, fraud or misrepresentation, the agreement is voidable at the option of the aggrieved party.', 1, 'BusinessLaws,ContractAct,Voidable'],

    ['Business Laws', 'Transfer of Property Act', 1, 'mcq', 'Under Transfer of Property Act 1882, what is "mortgage"?',
     'Transfer of ownership', 'Transfer of specific immovable property as security for loan', 'Gift of property', 'Sale of property',
     'B', 'Section 58 of Transfer of Property Act defines mortgage as transfer of an interest in specific immovable property as security for the payment of money.', 1, 'BusinessLaws,TransferOfProperty,Mortgage'],

    ['Business Laws', 'Sale of Goods Act', 1, 'mcq', 'Under Sale of Goods Act 1930, a contract of sale is:',
     'Transfer of ownership', 'Transfer of possession only', 'Both ownership and possession', 'Neither ownership nor possession',
     'A', 'Section 4 of Sale of Goods Act defines contract of sale as a contract whereby the seller transfers or agrees to transfer the property in goods to the buyer for a price.', 1, 'BusinessLaws,SaleOfGoods,ContractOfSale'],

    ['Business Laws', 'Partnership Act', 2, 'mcq', 'Under Partnership Act 1932, a partnership firm can be formed:',
     'With any number of partners', 'Maximum 10 partners', 'Maximum 20 partners', 'Maximum 50 partners',
     'A', 'Partnership Act 1932 does not prescribe maximum number of partners. However, Companies Act prescribes maximum 50 partners for a partnership firm (100 for banking business).', 1, 'BusinessLaws,PartnershipAct,Partners'],

    ['Business Laws', 'LLP Act', 1, 'mcq', 'Limited Liability Partnership (LLP) is governed by:',
     'Companies Act 2013', 'Partnership Act 1932', 'LLP Act 2008', 'IBC 2016',
     'C', 'Limited Liability Partnerships are governed by the Limited Liability Partnership Act 2008 and the rules made thereunder.', 1, 'BusinessLaws,LLPAct,LLP'],

    // General Laws
    ['General Laws', 'SARFAESI', 2, 'mcq', 'Under SARFAESI Act 2002, a secured creditor can enforce security interest without court intervention if the account is classified as NPA and notice period of how many days has expired?',
     '30 days', '45 days', '60 days', '90 days',
     'C', 'Section 13(2) of SARFAESI Act requires the secured creditor to serve a demand notice giving 60 days time to the borrower before taking measures under Section 13(4).', 1, 'GeneralLaws,SARFAESI,Section13'],

    ['General Laws', 'RDDBFI Act', 1, 'mcq', 'The Recovery of Debts and Bankruptcy Act 1993 provides for establishment of:',
     'NCLT', 'DRT and DRAT', 'IBBI', 'BIFR',
     'B', 'The Recovery of Debts Due to Banks and Financial Institutions Act 1993 (now RDDBFI Act) provides for establishment of Debt Recovery Tribunals (DRT) and Debt Recovery Appellate Tribunals (DRAT) for expeditious recovery of debts.', 1, 'GeneralLaws,RDDBFI,DRT'],

    ['General Laws', 'Competition Act', 2, 'mcq', 'The Competition Commission of India (CCI) was established under which Act?',
     'MRTP Act 1969', 'Competition Act 2002', 'Companies Act 2013', 'IBC 2016',
     'B', 'The Competition Commission of India was established under the Competition Act 2002, which replaced the MRTP Act 1969.', 1, 'GeneralLaws,CompetitionAct,CCI'],

    ['General Laws', 'FEMA', 1, 'mcq', 'FEMA stands for:',
     'Foreign Exchange Management Act', 'Foreign Export Management Act', 'Financial Emergency Management Act', 'Foreign Economic Management Act',
     'A', 'FEMA stands for Foreign Exchange Management Act, 1999 which replaced FERA (Foreign Exchange Regulation Act).', 1, 'GeneralLaws,FEMA,FullForm'],

    ['General Laws', 'Income Tax', 2, 'mcq', 'In IBC context, when a corporate debtor goes into liquidation, the Liquidator must settle income tax dues within:',
     '30 days', '60 days', '90 days', 'As per tax laws',
     'D', 'The Liquidator must settle tax dues as per the applicable tax laws. Income tax claims rank as government dues in the Section 53 waterfall.', 1, 'GeneralLaws,IncomeTax,Liquidation'],

    ['General Laws', 'Stamp Act', 1, 'mcq', 'Stamp duty is a tax on:',
     'Income', 'Property transactions', 'Sales', 'Services',
     'B', 'Stamp duty is a tax levied on property transactions and legal documents. The Stamp Act varies by state in India.', 1, 'GeneralLaws,StampAct,Definition'],

    ['General Laws', 'SFIO', 1, 'mcq', 'SFIO stands for:',
     'Serious Fraud Investigation Office', 'Securities and Foreign Investment Organization', 'State Financial Investigation Office', 'Strategic Financial Investment Organization',
     'A', 'SFIO stands for Serious Fraud Investigation Office, which investigates serious corporate frauds under Companies Act.', 1, 'GeneralLaws,SFIO,FullForm'],

    // Finance & Accounts
    ['Finance & Accounts', 'Financial Statements', 1, 'mcq', 'Which financial statement shows a company\'s financial position at a specific point in time?',
     'Profit & Loss Account', 'Cash Flow Statement', 'Balance Sheet', 'Statement of Changes in Equity',
     'C', 'The Balance Sheet (Statement of Financial Position) shows assets, liabilities and equity of a company at a specific date, reflecting the financial position at that point in time.', 1, 'Finance,BalanceSheet,FinancialStatements'],

    ['Finance & Accounts', 'Valuation', 2, 'mcq', 'Under IBC, Fair Value of assets of a corporate debtor is estimated by:',
     'Resolution Professional alone', 'Registered Valuers', 'Committee of Creditors', 'NCLT',
     'B', 'Regulation 27 of IBBI (CIRP) Regulations requires the RP to appoint two Registered Valuers to determine the fair value and liquidation value of the assets.', 1, 'Finance,Valuation,RegisteredValuers'],

    ['Finance & Accounts', 'Cash Flow', 2, 'mcq', 'Cash Flow Statement shows:',
     'Profitability over a period', 'Cash inflows and outflows over a period', 'Financial position at a point in time', 'Changes in equity',
     'B', 'Cash Flow Statement shows the cash inflows and outflows from operating, investing and financing activities over a period.', 1, 'Finance,CashFlow,Statement'],

    ['Finance & Accounts', 'Accounting Standards', 1, 'mcq', 'In India, Accounting Standards are issued by:',
     'ICAI', 'RBI', 'SEBI', 'IBBI',
     'A', 'The Institute of Chartered Accountants of India (ICAI) issues Accounting Standards in India. These are now called Ind AS (Indian Accounting Standards).', 1, 'Finance,AccountingStandards,ICAI'],

    ['Finance & Accounts', 'Ratio Analysis', 2, 'mcq', 'Current Ratio measures:',
     'Profitability', 'Liquidity', 'Solvency', 'Efficiency',
     'B', 'Current Ratio is a liquidity ratio that measures a company\'s ability to pay short-term obligations using current assets.', 1, 'Finance,RatioAnalysis,CurrentRatio'],

    ['Finance & Accounts', 'Corporate Finance', 2, 'mcq', 'Weighted Average Cost of Capital (WACC) is used in:',
     'Working capital management', 'Capital budgeting decisions', 'Dividend policy', 'Inventory management',
     'B', 'WACC is used as a discount rate in capital budgeting decisions to evaluate investment projects.', 1, 'Finance,CorporateFinance,WACC'],

    // General Awareness
    ['General Awareness', 'IBBI', 1, 'mcq', 'IBBI was established under which provision of IBC?',
     'Section 188', 'Section 195', 'Section 188 read with Section 195', 'Section 196',
     'C', 'The Insolvency and Bankruptcy Board of India (IBBI) was established under Section 188 of IBC 2016, and Section 195 provides for its powers and functions as a regulator.', 1, 'GeneralAwareness,IBBI,Establishment'],

    ['General Awareness', 'IBBI', 1, 'mcq', 'The chairperson of IBBI is appointed by:',
     'Government of India', 'RBI', 'SEBI', 'NCLT',
     'A', 'The Chairperson of IBBI is appointed by the Central Government. IBBI is a statutory body under the Ministry of Corporate Affairs.', 1, 'GeneralAwareness,IBBI,Chairperson'],

    ['General Awareness', 'Insolvency Ecosystem', 2, 'mcq', 'NCLT stands for:',
     'National Company Law Tribunal', 'National Corporate Law Tribunal', 'National Credit Law Tribunal', 'National Company Legal Tribunal',
     'A', 'NCLT stands for National Company Law Tribunal, which is the adjudicating authority for IBC matters under Companies Act 2013.', 1, 'GeneralAwareness,NCLT,FullForm'],

    ['General Awareness', 'Recent Amendments', 2, 'mcq', 'The IBC (Amendment) Act 2021 introduced which new process?',
     'Pre-Pack for MSMEs', 'Fast Track Liquidation', 'Voluntary CIRP', 'Cross-border insolvency',
     'A', 'IBC (Amendment) Act 2021 introduced Pre-Packaged Insolvency Resolution Process (PPIRP) for MSMEs through Chapter III-A (Sections 54A-54P).', 1, 'GeneralAwareness,Amendments,PrePack'],

    ['General Awareness', 'Key Statistics', 1, 'mcq', 'As per IBBI data, which sector has highest number of CIRP cases?',
     'Manufacturing', 'Services', 'Real Estate', 'Financial Services',
     'C', 'As per IBBI periodic statistics, Real Estate and Construction sector typically has the highest number of CIRP cases due to capital-intensive nature and project financing.', 1, 'GeneralAwareness,Statistics,SectorData'],

    // Case Studies - MCQ style
    ['Case Studies', 'CIRP', 3, 'mcq', 'ABC Ltd. owes Rs. 5 Crore to XYZ Bank (financial creditor). ABC Ltd. defaults. XYZ Bank files under Section 7. NCLT admits the application. The Resolution Professional (RP) takes charge. ABC Ltd.\'s promoter wants to continue managing the company. What happens?',
     'Promoter continues as management reports to RP', 'Board of Directors is suspended and RP manages the company', 'Promoter is arrested', 'NCLT appoints a government officer',
     'B', 'Section 17 of IBC: On the insolvency commencement date, the management of the affairs of the corporate debtor shall vest in the Interim Resolution Professional. The Board of Directors stands suspended and the powers vest in the IRP/RP.', 4, 'CaseStudy,CIRP,Management,Section17'],

    ['Case Studies', 'Liquidation', 3, 'mcq', 'After CIRP fails, ABC Ltd. goes into liquidation. The liquidation estate has Rs. 50 Lakhs. CIRP costs are Rs. 8 Lakhs. Workmen\'s dues for 24 months are Rs. 5 Lakhs. Unsecured financial creditors have claims of Rs. 60 Lakhs. What do unsecured financial creditors receive?',
     'Rs. 37 Lakhs', 'Rs. 60 Lakhs on pro-rata', 'Rs. 37 Lakhs on pro-rata', 'Nothing',
     'C', 'Section 53 waterfall: CIRP costs (Rs. 8L) paid first, leaving Rs. 42L. Workmen dues 24 months (Rs. 5L) paid next, leaving Rs. 37L. No secured creditors mentioned, so Rs. 37L goes to unsecured financial creditors on pro-rata against their Rs. 60L claim.', 4, 'CaseStudy,Liquidation,Waterfall,Section53'],

    ['Case Studies', 'Pre-Pack', 3, 'mcq', 'XYZ Pvt Ltd (MSME) has defaulted on loan of Rs. 2 Crore. The promoter approaches a buyer who is willing to infuse funds. They want to use Pre-Pack process. What is the first step?',
     'File Section 7 application with base resolution plan', 'IRP appointment and then CoC approval', 'NCLT orders liquidation', 'Wait for operational creditor to file',
     'A', 'For Pre-Pack PPIRP under Section 54A, the prospective resolution applicant must submit the base resolution plan along with the Section 7 application filed by the financial creditor before NCLT.', 4, 'CaseStudy,PrePack,Process,Section54A'],

    ['Case Studies', 'Individual Insolvency', 3, 'mcq', 'Mr. Sharma (individual) has debts of Rs. 15 Lakh and assets worth Rs. 8 Lakh. He wants to file for insolvency. Under IBC Part III, which process is available?',
     'CIRP', 'Fresh Start Process', 'Bankruptcy Process', 'Both Fresh Start and Bankruptcy',
     'D', 'Part III of IBC provides two processes for individuals: Fresh Start Process for debts up to specified threshold and assets up to specified value, and Bankruptcy Process for higher thresholds.', 4, 'CaseStudy,IndividualInsolvency,PartIII'],

    ['Case Studies', 'Business Laws Application', 3, 'mcq', 'During CIRP of Tech Solutions Ltd, a contract is terminated solely because the company is in insolvency proceedings. The RP challenges this termination. Under which principle can this be challenged?',
     'Section 14 moratorium', 'Contract Act provisions', 'Gujarat Urja principle on ipso facto clauses', 'Companies Act provisions',
     'C', 'Under Gujarat Urja v. Amit Gupta (SC 2021), termination of contracts solely on grounds of insolvency (ipso facto clauses) violates moratorium under Section 14(1)(d) of IBC.', 4, 'CaseStudy,BusinessLaws,Moratorium,GujaratUrja'],

    ['Case Studies', 'Ethics', 3, 'mcq', 'IP Sharma is acting as RP in the CIRP of PQR Ltd. One of the resolution applicants is a company where IP Sharma\'s brother holds 30% equity. IP Sharma does not disclose this. Which Code provision is violated?',
     'Section 208 of IBC on professional conduct', 'IBBI (IP) Regulations on conflict of interest and independence', 'Both A and B', 'Companies Act provisions',
     'C', 'An IP must disclose all conflicts of interest. Regulation 7(2)(h) of IBBI (IP) Regulations requires IPs to comply with the Code of Conduct. The Code mandates disclosure of conflicts. Section 208 also sets professional standards. Non-disclosure violates both.', 4, 'CaseStudy,Ethics,ConflictOfInterest'],

    ['Case Studies', 'Avoidance Transactions', 3, 'mcq', 'During the look-back period before CIRP admission, ABC Ltd. transferred a property to its promoter\'s wife at 50% of market value. This transaction can be challenged as:',
     'Preferential transaction', 'Undervalued transaction', 'Fraudulent transaction', 'Valid transaction',
     'B', 'Section 45 of IBC deals with undervalued transactions where assets are transferred for less than equivalent value. The look-back period is 2 years for related parties and 1 year for others.', 4, 'CaseStudy,AvoidanceTransactions,Undervalued,Section45'],

    ['Case Studies', 'Cross-Topic Application', 3, 'mcq', 'A power company in CIRP has a Power Purchase Agreement terminated by the state electricity board solely due to insolvency. The RP challenges this. The outcome depends on:',
     'Whether it is a financial contract under Section 14(2A)', 'Whether the contract is ipso facto clause', 'Both A and B', 'Neither A nor B',
     'C', 'Under Gujarat Urja case and Section 14(2A), termination of contracts solely on insolvency grounds violates moratorium, unless it falls under the financial contract exception under Section 14(2A).', 4, 'CaseStudy,CrossTopic,Moratorium,FinancialContracts'],

    // More IBC questions
    ['IBC', 'Pre-Pack', 2, 'mcq', 'Pre-Packaged Insolvency Resolution Process (PPIRP) under IBC is available for:',
     'All corporate debtors', 'Only MSMEs', 'Only listed companies', 'Only financial creditors',
     'B', 'Chapter III-A of IBC (Sections 54A-54P) introduced by IBC (Amendment) Act 2021 provides for PPIRP only for MSMEs (Micro, Small and Medium Enterprises).', 1, 'IBC,PrePack,MSME'],

    ['IBC', 'Individual Insolvency', 2, 'mcq', 'Part III of IBC deals with:',
     'Corporate Insolvency', 'Cross-border Insolvency', 'Insolvency of individuals and partnership firms', 'Voluntary liquidation',
     'C', 'Part III of IBC (Sections 78-187) deals with insolvency resolution and bankruptcy for individuals and partnership firms.', 1, 'IBC,Individual,PartIII'],

    ['IBC', 'Avoidance Transactions', 3, 'mcq', 'Section 43 of IBC deals with:',
     'Fraudulent trading', 'Preferential transactions', 'Undervalued transactions', 'Extortionate credit transactions',
     'B', 'Section 43 of IBC deals with preferential transactions — transactions where a corporate debtor gives preference to a creditor over others within the look-back period (2 years for related parties, 1 year for others).', 1, 'IBC,AvoidanceTransactions,Section43'],

    ['IBC', 'CIRP Timeline', 2, 'mcq', 'The outer limit for CIRP including extensions and litigation is:',
     '180 days', '270 days', '330 days', '365 days',
     'C', 'Section 12(3) of IBC provides that the overall period of CIRP including extension and litigation shall not exceed 330 days from insolvency commencement date.', 1, 'IBC,CIRP,OuterLimit,Section12'],

    ['IBC', 'CoC Meetings', 2, 'mcq', 'The Committee of Creditors must meet at least:',
     'Once every 30 days', 'Once every 60 days', 'Once every 90 days', 'No mandatory frequency',
     'A', 'Regulation 21 of IBBI (CIRP) Regulations requires the Committee of Creditors to meet at least once every 30 days during CIRP.', 1, 'IBC,CoC,Meetings,Regulations'],

    ['IBC', 'Resolution Plan Contents', 3, 'mcq', 'A resolution plan under IBC must include:',
     'Payment waterfall only', 'Investment plan and management structure', 'Both payment waterfall and management changes', 'Neither is mandatory',
     'C', 'Section 30(4) of IBC provides that a resolution plan must include the payment waterfall, implementation schedule, and may include changes in management.', 1, 'IBC,ResolutionPlan,Contents,Section30'],

    ['IBC', 'Liquidation Causes', 2, 'mcq', 'Liquidation can be ordered by NCLT when:',
     'Resolution plan is not received within CIRP period', 'CoC rejects resolution plan twice', 'Resolution applicant withdraws plan', 'All of the above',
     'D', 'Section 33 of IBC provides for ordering liquidation in multiple scenarios: no resolution plan received, CoC rejects plan twice, or applicant withdraws after second rejection.', 1, 'IBC,Liquidation,Causes,Section33'],

    ['IBC', 'Insolvency Professional Duties', 2, 'mcq', 'The primary duty of an Insolvency Professional under IBC is to:',
     'Maximize returns to creditors', 'Revive the corporate debtor', 'Both maximize value and act in fiduciary capacity', 'Only follow NCLT orders',
     'C', 'Under Section 208 and IBBI (IP) Regulations, an IP has a fiduciary duty to act in the best interests of stakeholders and maximize value of assets while following the Code.', 1, 'IBC,IP,Duties,Section208'],

    ['IBC', 'Operational Creditor', 1, 'mcq', 'Who is NOT considered an operational creditor under IBC?',
     'Supplier of goods', 'Supplier of services', 'Employee with salary dues', 'Lender of money',
     'D', 'Operational creditors are those to whom operational debt is owed (goods/services, employees). Lenders of money are financial creditors under Section 5(8) of IBC.', 1, 'IBC,OperationalCreditor,Definition,Section5'],

    ['IBC', 'Financial Creditor', 1, 'mcq', 'Financial debt under IBC includes:',
     'Trade credit', 'Loan with interest', 'Salary dues', 'Goods supplied on credit',
     'B', 'Section 5(8) of IBC defines financial debt to include a debt along with interest, if any, which is disbursed against consideration for time value of money.', 1, 'IBC,FinancialCreditor,Definition,Section5'],
  ];

  const insertMany = db.transaction((qs) => {
    for (const q of qs) insertQ.run(...q);
  });
  insertMany(questions);

  // Seed case laws
  const insertCL = db.prepare(`
    INSERT INTO case_laws (case_name, court, year, citation, facts, issue, provisions, judgment, outcome, exam_principle, topic)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const caseLaws = [
    ['Committee of Creditors of Essar Steel India Ltd. v. Satish Kumar Gupta',
     'Supreme Court', 2019, '(2019) 8 SCC 1 / (2020) 8 SCC 531',
     'Essar Steel underwent CIRP. The NCLAT modified the resolution plan approved by CoC by directing equal treatment of all financial and operational creditors. The resolution plan was challenged.',
     'Whether NCLAT can modify a resolution plan approved by CoC? What is the binding nature of CoC decisions? Whether secured financial creditors can be differentiated from operational creditors?',
     'Sections 30, 31, 53 of IBC; IBBI (CIRP) Regulations',
     'Supreme Court held: (1) CoC has commercial wisdom to decide distribution in resolution plan. (2) NCLAT cannot modify commercial decisions of CoC. (3) Differentiation between financial and operational creditors is valid. (4) Resolution plan must provide for payment of at least liquidation value to dissenting creditors.',
     'NCLAT order set aside. Resolution plan as approved by CoC restored.',
     'CoC\'s commercial wisdom is paramount. Courts cannot substitute their judgment for CoC\'s commercial decisions. Secured financial creditors can be differentiated from operational creditors in a resolution plan.',
     'CIRP'],

    ['Swiss Ribbons Pvt. Ltd. v. Union of India',
     'Supreme Court', 2019, '(2019) 4 SCC 17',
     'Constitutional validity of IBC was challenged on grounds of discrimination between financial and operational creditors, arbitrary powers to IBBI, etc.',
     'Whether IBC is constitutionally valid? Whether differentiation between financial and operational creditors is arbitrary?',
     'Articles 14, 19(1)(g) of Constitution; Sections 7, 8, 9, 21, 24, 25, 28, 30 of IBC',
     'Supreme Court upheld constitutional validity of IBC. Held: (1) IBC is not a recovery law but a resolution law. (2) Differentiation between financial and operational creditors is intelligible differentia with rational nexus to object. (3) IBBI has quasi-judicial powers. (4) IBC aims at revival of company as going concern.',
     'IBC upheld as constitutionally valid.',
     'IBC is a complete code for resolution, not merely a recovery mechanism. Differentiation between creditors is constitutionally valid. The primary objective is maximisation of value of assets.',
     'Constitutional Validity'],

    ['Mobilox Innovations Pvt. Ltd. v. Kirusa Software Pvt. Ltd.',
     'Supreme Court', 2018, '(2018) 1 SCC 353',
     'Kirusa filed an application under Section 9 against Mobilox for unpaid operational dues. Mobilox raised a dispute about quality of services. NCLT admitted the application. NCLAT affirmed.',
     'What constitutes a "dispute" under Section 8(2)(a) of IBC to defeat an operational creditor\'s application under Section 9?',
     'Sections 8, 9 of IBC 2016',
     'SC held: A "pre-existing dispute" must exist before the demand notice under Section 8. The word "dispute" includes any bona fide dispute raised. NCLT is not required to examine merits of dispute — only whether a plausible dispute exists.',
     'Application rejected. Matter remanded.',
     'Under Section 9, NCLT must be satisfied that there is NO pre-existing dispute before admitting the application. The existence of a bona fide pre-existing dispute is a complete defence to a Section 9 application.',
     'CIRP'],

    ['Arcelormittal India Pvt. Ltd. v. Satish Kumar Gupta',
     'Supreme Court', 2018, '(2019) 2 SCC 1',
     'Question arose whether persons who were promoters/directors of NPA companies were eligible to be resolution applicants under IBC.',
     'Whether Section 29A of IBC (eligibility criteria for resolution applicants) is constitutionally valid? Who is disqualified from submitting resolution plan?',
     'Section 29A of IBC 2016',
     'SC upheld Section 29A as constitutional. Held: (1) Promoters/connected persons who pushed the company into insolvency cannot be allowed to buy it back at a discount through IRP process. (2) "Control" under Section 29A(c) must be read broadly. (3) The provision prevents persons who contributed to corporate debtor\'s insolvency from benefiting.',
     'Section 29A upheld. Certain resolution applicants held ineligible.',
     'Section 29A bars willful defaulters, undischarged insolvents, persons convicted of certain offences, and persons connected to NPA accounts from being resolution applicants. Protects IBC from misuse by erstwhile promoters.',
     'Resolution Plan'],

    ['Innoventive Industries Ltd. v. ICICI Bank',
     'Supreme Court', 2018, '(2018) 1 SCC 407',
     'First major IBC case. ICICI Bank filed Section 7 application against Innoventive Industries. Corporate debtor contended that Maharashtra Relief Undertakings Act protected it from insolvency proceedings.',
     'Whether IBC overrides state laws? What is the nature of NCLT\'s jurisdiction under Section 7?',
     'Sections 7, 14 of IBC; Article 254 of Constitution',
     'SC held: (1) IBC overrides all state enactments by repugnancy under Article 254. (2) NCLT must admit Section 7 application if satisfied that: (a) applicant is a financial creditor, (b) a debt exists, (c) a default has occurred. (3) NCLT cannot go behind a default once established.',
     'Section 7 application admitted. State law protection rejected.',
     'IBC is a central law and overrides state laws. Once default is established, NCLT must admit Section 7 application — no discretion. Moratorium under Section 14 has overriding effect.',
     'CIRP'],

    ['K. Sashidhar v. Indian Overseas Bank',
     'Supreme Court', 2019, '(2019) 12 SCC 150',
     'Resolution plan was rejected by CoC with 75% voting (before amendment reducing threshold to 66%). Question arose whether NCLT/NCLAT can approve a plan rejected by CoC.',
     'Whether NCLT can approve a resolution plan if CoC has rejected it? What is the scope of judicial review of CoC decisions?',
     'Sections 30(4), 31 of IBC (pre-2019 amendment)',
     'SC held: (1) NCLT and NCLAT have limited jurisdiction to review CoC decisions. (2) If resolution plan is rejected by CoC, tribunal has no jurisdiction to approve it. (3) Liquidation must follow. (4) The adjudicating authority cannot examine the commercial wisdom of CoC.',
     'Plan rejection by CoC upheld. Liquidation ordered.',
     'Once CoC rejects a resolution plan, NCLT has no jurisdiction to approve it. Judicial review of CoC decisions is very limited — only on grounds of non-compliance with procedure or law, not commercial merits.',
     'Resolution Plan'],

    ['Gujarat Urja Vikas Nigam Ltd. v. Amit Gupta',
     'Supreme Court', 2021, '(2021) 7 SCC 209',
     'Power Purchase Agreement (PPA) was terminated by GUVNL on grounds of insolvency-related default. RP challenged the termination claiming it violated the moratorium.',
     'Whether termination of contracts solely on grounds of insolvency violates moratorium under Section 14(1)(d)? What is ipso facto clause?',
     'Sections 14(1)(d), 14(2A) of IBC',
     'SC held: (1) Termination of contracts solely on the ground of insolvency (ipso facto clauses) violates moratorium. (2) However, Section 14(2A) carves out an exception for financial contracts. (3) Government contracts can be terminated if termination is not ipso facto but for other valid reasons.',
     'PPA termination held invalid as it was solely due to insolvency.',
     'Ipso facto clauses — contract termination solely on insolvency — violate moratorium. Contracts cannot be terminated only because of insolvency proceedings. Exception for financial contracts under 14(2A).',
     'Moratorium'],

    ['Phoenix ARC Pvt. Ltd. v. Spade Financial Services Ltd.',
     'Supreme Court', 2020, '(2020) 12 SCC 636',
     'Issue related to whether a non-performing asset can be sold at a price less than the fair value determined by valuers.',
     'Whether sale of NPA below fair value is permissible? What is the role of registered valuers in asset valuation?',
     'Section 29A, IBC; SARFAESI Act; Regulation 27 of IBBI (CIRP) Regulations',
     'SC held: (1) Sale of NPA below fair value is permissible if it is the best possible offer. (2) Fair value is only a reference point, not the floor price. (3) CoC has commercial wisdom to accept the best offer even if below fair value.',
     'Sale of NPA below fair value upheld.',
     'Fair value determined by registered valuers is not the minimum price for asset sale. CoC\'s commercial wisdom prevails in accepting the best offer for maximization of value.',
     'Resolution Plan'],

    ['Jindal Steel & Power Ltd. v. National Company Law Tribunal',
     'Supreme Court', 2021, '(2021) 13 SCC 436',
     'Issue regarding the period of limitation for filing application under Section 7 of IBC.',
     'What is the limitation period for filing Section 7 application after default?',
     'Section 7 of IBC; Limitation Act 1963',
     'SC held: (1) For financial creditors, limitation starts from the date of default and not from the date of demand notice. (2) If the debt is a time-barred debt, Section 7 application cannot be filed. (3) Financial debt must be established along with default.',
     'Application held time-barred was rejected.',
     'Section 7 application must be filed within the limitation period from the date of default. Time-barred debts cannot be the basis for CIRP application.',
     'CIRP'],

    ['V. Padmakumar v. Stressed Assets Stabilisation Fund',
     'Supreme Court', 2019, '(2019) 11 SCC 358',
     'Issue regarding immunity from civil proceedings against the Resolution Professional.',
     'Whether RP has immunity from civil proceedings for actions taken in good faith during CIRP?',
     'Section 234 of IBC; Regulation 6 of IBBI (IP) Regulations',
     'SC held: (1) RP has immunity from civil proceedings for actions taken in good faith in discharge of duties. (2) This immunity is not absolute and does not extend to fraudulent or malicious acts. (3) The immunity is necessary for effective functioning of CIRP.',
     'RP granted immunity for actions taken in good faith.',
     'Resolution Professionals have immunity from civil suits for actions taken in good faith during CIRP. This immunity is necessary for effective implementation of IBC.',
     'Insolvency Professional'],

    ['MBR Infrastructures Ltd. v. Tata Steel Ltd.',
     'NCLAT', 2018, '2018 SCC OnLine NCLAT 366',
     'Issue regarding whether CoC can reject all resolution plans and direct liquidation.',
     'Whether CoC can reject all resolution plans and opt for liquidation?',
     'Sections 29, 33 of IBC',
     'NCLAT held: (1) CoC has the commercial wisdom to reject all resolution plans. (2) If CoC rejects all plans, liquidation follows as per Section 33. (3) NCLT cannot force CoC to accept a resolution plan.',
     'CoC decision to reject all plans upheld.',
     'CoC has the commercial wisdom to reject all resolution plans. Liquidation is the inevitable consequence if no acceptable resolution plan is received.',
     'Committee of Creditors'],

    ['Pioneer Polyleathers Pvt. Ltd. v. Union of India',
     'Supreme Court', 2019, '(2019) 8 SCC 508',
     'Issue regarding whether operational creditors can be part of CoC.',
     'Whether operational creditors can be members of Committee of Creditors?',
     'Section 21 of IBC',
     'SC held: (1) Operational creditors are not members of CoC under Section 21. (2) They can only participate in meetings if CoC decides. (3) This distinction is constitutionally valid as upheld in Swiss Ribbons.',
     'Operational creditors held not to be CoC members.',
     'Operational creditors are not members of CoC unless there are no financial creditors. They have limited participation rights in CIRP.',
     'Committee of Creditors'],

    ['Insolvency Professional v. IBBI',
     'NCLAT', 2020, '2020 SCC OnLine NCLAT 142',
     'Issue regarding disciplinary proceedings against Insolvency Professional.',
     'Whether IBBI can initiate disciplinary proceedings against IP for misconduct?',
     'Section 204 of IBC; IBBI (IP) Regulations',
     'NCLAT held: (1) IBBI has power to initiate disciplinary proceedings against IPs for misconduct. (2) The procedure must be fair and natural justice must be followed. (3) Penalties can include suspension or cancellation of registration.',
     'IBBI disciplinary powers upheld.',
     'IBBI has disciplinary jurisdiction over Insolvency Professionals. IPs must adhere to the Code of Conduct and can face penalties for misconduct.',
     'Insolvency Professional'],

    ['Binani Industries Ltd. v. Bank of Baroda',
     'NCLAT', 2018, '2018 SCC OnLine NCLAT 544',
     'Issue regarding whether CoC can extend CIRP period beyond statutory limits.',
     'Whether CoC can extend CIRP beyond 270 days?',
     'Section 12 of IBC',
     'NCLAT held: (1) CIRP period is 180 days extendable by 90 days (total 270 days). (2) CoC cannot extend beyond statutory limits. (3) Extension beyond 270 days requires NCLT approval under exceptional circumstances.',
     'Extension beyond 270 days without NCLT approval not allowed.',
     'CIRP timeline is statutorily fixed at 180+90 days. CoC cannot extend beyond this without NCLT approval in exceptional circumstances.',
     'CIRP'],

    ['Jaypee Infratech Ltd. v. NBCC',
     'Supreme Court', 2019, '(2019) 1 SCC 738',
     'Issue regarding homebuyers as financial creditors and resolution plan for real estate projects.',
     'Whether homebuyers are financial creditors? Can resolution plan include completion of unfinished projects?',
     'Section 5(8)(f) of IBC; Section 30 of IBC',
     'SC held: (1) Homebuyers are financial creditors under Section 5(8)(f). (2) Resolution plan can include completion of unfinished real estate projects. (3) Maximum value for homebuyers can be the amount paid or actual cost of apartment, whichever is higher.',
     'Homebuyers recognized as financial creditors.',
     'Homebuyers are financial creditors under IBC. Resolution plans for real estate companies can include project completion as part of the resolution strategy.',
     'Resolution Plan'],

    ['Ruchi Soya Industries Ltd. v. Patanjali Ayurved Ltd.',
     'NCLAT', 2019, '2019 SCC OnLine NCLAT 892',
     'Issue regarding eligibility of resolution applicant with non-performing assets.',
     'Whether a resolution applicant with NPAs in other companies is eligible under Section 29A?',
     'Section 29A of IBC',
     'NCLAT held: (1) Section 29A disqualifies resolution applicants with NPAs. (2) The disqualification applies to the applicant and related parties. (3) However, NPA must be subsisting as on the date of application.',
     'Resolution applicant held ineligible due to NPA.',
     'Section 29A disqualifies resolution applicants with non-performing assets. This prevents entities that have contributed to insolvency from acquiring stressed assets.',
     'Resolution Plan'],
  ];

  const insertCLMany = db.transaction((cls) => {
    for (const cl of cls) insertCL.run(...cl);
  });
  insertCLMany(caseLaws);

  // Seed case studies
  const insertCS = db.prepare(`INSERT INTO case_studies (title, scenario, topic, difficulty) VALUES (?, ?, ?, ?)`);
  const insertCSQ = db.prepare(`
    INSERT INTO case_study_questions (case_study_id, question, option_a, option_b, option_c, option_d, correct_answer, explanation, marks)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const seedCaseStudies = db.transaction(() => {
    // Case Study 1: CIRP
    const cs1 = insertCS.run(
      'CIRP of Sunrise Steel Ltd.',
      'Sunrise Steel Ltd. (SSL) is a company incorporated under the Companies Act 2013. SSL took a term loan of Rs. 200 Crore from National Bank (NB) and working capital facilities of Rs. 50 Crore from City Bank (CB). SSL also owes Rs. 10 Crore to ABC Suppliers (an operational creditor) for raw material supply. SSL defaulted on repayment of term loan instalment of Rs. 15 Crore to National Bank on 1 January 2024. National Bank issued a demand notice. SSL did not respond. National Bank filed an application under Section 7 before NCLT on 15 February 2024. NCLT admitted the application on 1 March 2024 and appointed Mr. Ravi Sharma as IRP. SSL has 500 employees and owns a manufacturing plant worth Rs. 300 Crore (as per books) and Rs. 250 Crore (fair value).',
      'CIRP', 2
    );

    insertCSQ.run(cs1.lastInsertRowid, 'On admission of the Section 7 application on 1 March 2024, what is the "insolvency commencement date"?', '1 January 2024 (date of default)', '15 February 2024 (date of filing)', '1 March 2024 (date of admission by NCLT)', 'Date of appointment of IRP', 'C', 'Section 5(12) of IBC defines "insolvency commencement date" as the date of admission of the application under Sections 7, 9 or 10 by the Adjudicating Authority (NCLT). It is 1 March 2024.', 4);

    insertCSQ.run(cs1.lastInsertRowid, 'After Mr. Ravi Sharma is appointed as IRP, what happens to the Board of Directors of SSL?', 'Board continues to function under IRP supervision', 'Board is dissolved permanently', 'Board is suspended and powers vest in IRP', 'Board is asked to resign within 7 days', 'C', 'Section 17 of IBC: On insolvency commencement date, management of corporate debtor vests in IRP and Board of Directors stands suspended. IRP takes over management of the corporate debtor.', 4);

    insertCSQ.run(cs1.lastInsertRowid, 'Mr. Ravi Sharma must constitute the Committee of Creditors (CoC). Who will be members of the CoC?', 'National Bank and City Bank only', 'National Bank, City Bank and ABC Suppliers', 'All creditors including employees', 'Only National Bank as it has the largest claim', 'A', 'Section 21 of IBC: CoC shall comprise all financial creditors. Operational creditors are NOT members of CoC unless there are no financial creditors. National Bank (Rs. 200 Cr) and City Bank (Rs. 50 Cr) are financial creditors. ABC Suppliers is an operational creditor and will not be part of CoC.', 4);

    insertCSQ.run(cs1.lastInsertRowid, 'The CoC resolves to extend CIRP by 90 days. The voting requirement for this resolution is:', '51% of voting share', '60% of voting share', '66% of voting share', '75% of voting share', 'C', 'Section 12(2) of IBC: The resolution for extension of CIRP period requires approval of CoC by a vote of 66% of voting shares. The voting share of each financial creditor is in proportion to their financial debt.', 4);

    // Case Study 2: Liquidation
    const cs2 = insertCS.run(
      'Liquidation of Phoenix Textiles Ltd.',
      'Phoenix Textiles Ltd. (PTL) underwent CIRP. No resolution plan was received within the CIRP period. The NCLT passed a liquidation order on 1 June 2024 and appointed Ms. Priya Mehta as Liquidator. The assets of PTL are: Factory land and building (secured by National Bank) — Rs. 80 Crore; Machinery — Rs. 20 Crore; Stock and receivables — Rs. 15 Crore. CIRP costs: Rs. 3 Crore. National Bank (secured creditor): Rs. 90 Crore claim, security of factory worth Rs. 80 Crore. Employees: 24-month wages due Rs. 5 Crore. Government dues (GST): Rs. 4 Crore. Unsecured operational creditors: Rs. 25 Crore.',
      'Liquidation', 3
    );

    insertCSQ.run(cs2.lastInsertRowid, 'What is the total realisation available for distribution (assuming all assets are sold at stated values)?', 'Rs. 115 Crore', 'Rs. 112 Crore', 'Rs. 110 Crore', 'Rs. 105 Crore', 'A', 'Total assets = Factory (80) + Machinery (20) + Stock/Receivables (15) = Rs. 115 Crore. This is the total liquidation estate available for distribution.', 4);

    insertCSQ.run(cs2.lastInsertRowid, 'After paying CIRP costs of Rs. 3 Crore and workmen/employee dues of Rs. 5 Crore, how much is available for National Bank (secured creditor)?', 'Rs. 107 Crore', 'Rs. 80 Crore', 'Rs. 90 Crore', 'Rs. 112 Crore', 'A', 'Section 53 waterfall: Step 1 — CIRP costs Rs. 3 Cr. Step 2 — Workmen (24 months) Rs. 5 Cr. After these two: 115 - 3 - 5 = Rs. 107 Cr available. National Bank as secured creditor ranks next and gets up to Rs. 90 Cr (their claim), leaving Rs. 17 Cr.', 4);

    insertCSQ.run(cs2.lastInsertRowid, 'National Bank relinquished its security to the liquidation estate. After paying CIRP costs and workmen dues, in the Section 53 waterfall, unsecured operational creditors will receive:', 'Rs. 25 Crore in full', 'Rs. 13 Crore on pro-rata basis', 'Nothing, as funds are exhausted', 'Rs. 17 Crore on pro-rata', 'B', 'After CIRP costs (3) + workmen dues (5) + National Bank secured (90) + Government dues (4) = 102 Cr. Remaining = 115 - 102 = 13 Cr. Operational creditors get Rs. 13 Cr on pro-rata against their Rs. 25 Cr claim. (Note: Employee dues beyond 24 months and remaining secured creditor claims would also need consideration — simplified here.)', 4);

    // Case Study 3: Pre-Pack for MSME
    const cs3 = insertCS.run(
      'Pre-Pack of TechSolutions Pvt Ltd (MSME)',
      'TechSolutions Pvt Ltd is an MSME (investment in plant and machinery: Rs. 45 Lakhs). It has defaulted on a loan of Rs. 1.5 Crore from ABC Bank. The promoter has found a buyer, Digital Corp, willing to invest Rs. 2 Crore and revive the company. They want to use the Pre-Packaged Insolvency Resolution Process (PPIRP). The promoter approaches ABC Bank with a base resolution plan. ABC Bank files a Section 7 application along with the base resolution plan.',
      'Pre-Pack', 3
    );

    insertCSQ.run(cs3.lastInsertRowid, 'Is TechSolutions Pvt Ltd eligible for Pre-Packaged Insolvency Resolution Process?', 'Yes, as it is an MSME', 'No, as default amount is above threshold', 'No, only listed companies are eligible', 'Yes, all companies are eligible', 'A', 'Chapter III-A of IBC (Sections 54A-54P) provides for PPIRP only for MSMEs (Micro, Small and Medium Enterprises) as defined under the MSMED Act 2006. TechSolutions qualifies as an MSME.', 4);

    insertCSQ.run(cs3.lastInsertRowid, 'Under Pre-Pack process, when must the base resolution plan be submitted?', 'After IRP appointment', 'Before admission of CIRP application', 'During CoC meeting', 'At the time of plan approval', 'B', 'Under Pre-Pack Regulations, the prospective resolution applicant must submit the base resolution plan along with the Section 7 application filed by the financial creditor before NCLT.', 4);

    insertCSQ.run(cs3.lastInsertRowid, 'If the CoC rejects the base resolution plan under Pre-Pack, what happens?', 'Liquidation automatically follows', 'New resolution applicants can submit plans', 'Promoter can appeal to NCLAT', 'Process restarts with new base plan', 'B', 'Under PPIRP, if CoC rejects the base plan, the process converts to regular CIRP and other resolution applicants can submit resolution plans. The base plan applicant gets certain advantages but not exclusivity.', 4);

    insertCSQ.run(cs3.lastInsertRowid, 'What is the timeline for completing Pre-Pack process for MSMEs?', '90 days', '120 days', '180 days', '330 days', 'A', 'For MSMEs, the Pre-Pack process must be completed within 90 days from the insolvency commencement date. This is shorter than the regular CIRP timeline of 180 days extendable to 270 days.', 4);

    // Case Study 4: Individual Insolvency
    const cs4 = insertCS.run(
      'Individual Insolvency of Mr. Rajesh Kumar',
      'Mr. Rajesh Kumar, a sole proprietor, has taken personal loans totaling Rs. 25 Lakhs from various lenders. His business has failed and he has no assets except a small residential property worth Rs. 8 Lakhs (which is his only residence). He wants to file for insolvency under IBC Part III. His monthly income is Rs. 15,000 from freelance work.',
      'Individual Insolvency', 3
    );

    insertCSQ.run(cs4.lastInsertRowid, 'Which process under IBC Part III is available to Mr. Rajesh Kumar given his debt level and assets?', 'Fresh Start Process', 'Bankruptcy Process', 'Both Fresh Start and Bankruptcy', 'Neither process is available', 'A', 'Given his debt level (Rs. 25 Lakhs) and asset value (Rs. 8 Lakhs), Mr. Rajesh Kumar would likely qualify for the Fresh Start Process if thresholds are met. The exact thresholds are prescribed by the government but Fresh Start is for lower debt/assets cases.', 4);

    insertCSQ.run(cs4.lastInsertRowid, 'Under the Fresh Start Process, what happens to Mr. Rajesh Kumar\'s residential property?', 'It will be sold to repay debts', 'It may be exempt up to a certain value', 'It automatically becomes property of the trustee', 'He can retain it without conditions', 'B', 'Under Fresh Start Process, certain essential assets including residential property up to a prescribed value may be exempt from liquidation, allowing the debtor a fresh start while creditors receive partial payment from other assets.', 4);

    insertCSQ.run(cs4.lastInsertRowid, 'If Mr. Rajesh Kumar completes the Fresh Start Process successfully, what is the status of his remaining debts?', 'All debts are written off', 'Debts are restructured and he must pay', 'He remains liable for all debts', 'Debts are suspended for 5 years', 'A', 'Upon successful completion of Fresh Start Process, the debtor receives a discharge from all qualifying debts, giving them a fresh start. This is similar to bankruptcy discharge in other jurisdictions.', 4);

    insertCSQ.run(cs4.lastInsertRowid, 'What is the role of the Insolvency Professional in individual insolvency under IBC?', 'Manage the debtor\'s affairs', 'Evaluate the debtor\'s assets and liabilities', 'Distribute proceeds to creditors', 'All of the above', 'D', 'The Insolvency Professional (or trustee as the case may be) in individual insolvency manages the process, evaluates assets and liabilities, and distributes proceeds to creditors according to the prescribed waterfall for individuals.', 4);

    // Case Study 5: Cross-Topic Moratorium Application
    const cs5 = insertCS.run(
      'Power Purchase Agreement Termination - Energy Corp',
      'Energy Corp Ltd is in CIRP. It has a Power Purchase Agreement (PPA) with State Electricity Board (SEB). The SEB terminates the PPA citing Energy Corp\'s insolvency and default on payments. The RP challenges this termination, arguing it violates the moratorium under Section 14 of IBC. The SEB claims termination is due to default and not solely due to insolvency.',
      'CIRP', 3
    );

    insertCSQ.run(cs5.lastInsertRowid, 'Under the Gujarat Urja v. Amit Gupta principle, when does contract termination violate moratorium?', 'Any termination during CIRP', 'Termination solely on grounds of insolvency', 'Termination for payment default', 'All contract terminations are prohibited', 'B', 'As per Gujarat Urja case, termination of contracts solely on grounds of insolvency (ipso facto clauses) violates moratorium under Section 14(1)(d). Termination for valid commercial reasons (not solely insolvency) may be permitted.', 4);

    insertCSQ.run(cs5.lastInsertRowid, 'Is the PPA a financial contract that would fall under the exception to moratorium under Section 14(2A)?', 'Yes, all PPAs are financial contracts', 'No, PPA is not a financial contract', 'Yes, if it involves derivatives', 'Depends on SEB regulations', 'B', 'A Power Purchase Agreement is typically not a financial contract under Section 14(2A). Financial contracts generally include securities, derivatives, repo transactions, etc. PPAs are commercial contracts and termination solely for insolvency would violate moratorium.', 4);

    insertCSQ.run(cs5.lastInsertRowid, 'If the SEB cannot terminate the PPA, what are Energy Corp\'s obligations under the agreement?', 'All obligations are suspended during CIRP', 'Energy Corp must continue performing if it can', 'SEB must continue buying power at agreed rates', 'The agreement becomes void', 'B', 'Under moratorium, the corporate debtor\'s obligations continue if performance is possible. The counterparty cannot terminate solely due to insolvency but the debtor must perform if it has the means. The rights and obligations are modified but not extinguished.', 4);

    insertCSQ.run(cs5.lastInsertRowid, 'What happens if the termination was indeed for payment default (not solely insolvency)?', 'It would violate moratorium', 'It would be permitted under IBC', 'NCLT would decide based on facts', 'RP must appeal to NCLAT', 'C', 'If termination is for actual payment default and not solely due to insolvency status, the analysis changes. NCLT would examine the facts to determine if the termination is ipso facto (solely insolvency-based) or based on legitimate commercial grounds. The Gujarat Urja distinction is critical.', 4);

    // Case Study 6: Business Laws - Contract Act Application
    const cs6 = insertCS.run(
      'Contract Dispute During CIRP - BuildCorp Ltd',
      'BuildCorp Ltd is in CIRP. Before CIRP, it had entered into a contract with Supplier X for construction materials. The contract had a clause stating "this contract shall terminate if either party becomes insolvent." Supplier X terminates the contract citing this clause when BuildCorp enters CIRP. The RP challenges this termination.',
      'Business Laws', 3
    );

    insertCSQ.run(cs6.lastInsertRowid, 'The contract clause "terminates if either party becomes insolvent" is known as:', 'Force majeure clause', 'Ipso facto clause', 'Arbitration clause', 'Penalty clause', 'B', 'An ipso facto clause is a contract provision that allows termination or modification of the contract upon occurrence of insolvency or bankruptcy proceedings. Such clauses are generally ineffective under IBC moratorium.', 4);

    insertCSQ.run(cs6.lastInsertRowid, 'Under Indian Contract Act, when does an agreement become void?', 'When it is against public policy', 'When it is prohibited by law', 'When parties are minors', 'All of the above', 'D', 'Under Section 23 of Indian Contract Act, agreements are void if they are against public policy, prohibited by law, involve fraud/misrepresentation, or if parties lack capacity (minors, persons of unsound mind). An ipso facto clause may be void under IBC even if valid under Contract Act.', 4);

    insertCSQ.run(cs6.lastInsertRowid, 'How does the principle in Gujarat Urja apply to this contract termination?', 'It would invalidate the termination', 'It would uphold the termination', 'It does not apply to commercial contracts', 'Only Supreme Court can decide', 'A', 'Gujarat Urja principle applies to contract termination solely on grounds of insolvency. The clause allowing termination "if either party becomes insolvent" is a classic ipso facto clause and would be ineffective under IBC moratorium.', 4);

    insertCSQ.run(cs6.lastInsertRowid, 'What remedies does the RP have against Supplier X for wrongful termination?', 'Claim damages for breach of contract', 'Seek specific performance of contract', 'Both A and B', 'No remedy as contract is void', 'C', 'The RP can seek remedies for wrongful termination that violates moratorium. This may include damages for breach of contract or seeking specific performance if the contract is essential for the corporate debtor\'s revival.', 4);
  });

  seedCaseStudies();
}

module.exports = { db, initDB };
