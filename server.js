javascript
require('dotenv').config();

const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { db, initDB } = require('./db');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const PORT = process.env.PORT || 3000;

// ─────────────────────────────────────────────────────────────────────────────
// DATABASE
// ─────────────────────────────────────────────────────────────────────────────

initDB();

// ─────────────────────────────────────────────────────────────────────────────
// GEMINI
// ─────────────────────────────────────────────────────────────────────────────

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const geminiModel = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash'
});

// ─────────────────────────────────────────────────────────────────────────────
// MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────────────

app.use(express.json());

app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'ibbi_secret_2025',
  resave: false,
  saveUninitialized: true,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
}));

// Ensure every visitor gets a session/user
app.use((req, res, next) => {
  try {
    if (!req.session.userId) {
      req.session.userId = uuidv4();

      db.prepare(
        'INSERT OR IGNORE INTO users (id, name) VALUES (?, ?)'
      ).run(
        req.session.userId,
        'Guest User'
      );

      db.prepare(
        'INSERT OR IGNORE INTO sessions (id, user_id) VALUES (?, ?)'
      ).run(
        req.session.userId,
        req.session.userId
      );
    }

    next();
  } catch (error) {
    console.error('Session initialization error:', error);
    next(error);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SYLLABUS DATA
// ─────────────────────────────────────────────────────────────────────────────

const SYLLABUS = [
  {
    topic: 'IBC',
    weight: 4,
    subtopics: [
      'CIRP Initiation',
      'Moratorium',
      'Committee of Creditors',
      'Resolution Plan',
      'Liquidation',
      'Pre-Pack (PPIRP)',
      'Individual Insolvency',
      'Cross-border Insolvency',
      'Avoidance Transactions',
      'Voluntary Liquidation'
    ]
  },
  {
    topic: 'Rules & Regulations',
    weight: 6,
    subtopics: [
      'IBBI (CIRP) Regulations',
      'IBBI (Liquidation Process) Regulations',
      'IBBI (IP) Regulations',
      'IBBI (IPA) Regulations',
      'IBBI (Voluntary Liquidation) Regulations',
      'IBBI (Pre-Pack) Regulations',
      'IBBI (Grievance) Regulations',
      'IBBI (Model Bye-Laws) Regulations'
    ]
  },
  {
    topic: 'Business Laws',
    weight: 4,
    subtopics: [
      'Companies Act 2013',
      'Contract Act 1872',
      'Transfer of Property Act 1882',
      'Sale of Goods Act 1930',
      'Partnership Act 1932',
      'LLP Act 2008'
    ]
  },
  {
    topic: 'General Laws',
    weight: 7,
    subtopics: [
      'SARFAESI Act 2002',
      'RDDBFI Act 1993',
      'Prevention of Fraud (SFIO)',
      'Competition Act 2002',
      'FEMA',
      'Income Tax (IBC context)',
      'Stamp Act'
    ]
  },
  {
    topic: 'Finance & Accounts',
    weight: 2,
    subtopics: [
      'Financial Statements Analysis',
      'Valuation Principles',
      'Corporate Finance Basics',
      'Accounting Standards (IBC context)'
    ]
  },
  {
    topic: 'General Awareness',
    weight: 2,
    subtopics: [
      'IBBI',
      'Insolvency Ecosystem',
      'Recent Amendments',
      'Key Statistics'
    ]
  },
  {
    topic: 'Case Laws',
    weight: 5,
    subtopics: [
      'Supreme Court',
      'High Court',
      'NCLAT',
      'NCLT'
    ]
  },
  {
    topic: 'Case Studies',
    weight: 70,
    subtopics: [
      'CIRP Case Studies',
      'Liquidation Case Studies',
      'Pre-Pack Case Studies',
      'Individual Insolvency Cases',
      'Ethics & Professional Conduct',
      'Business Laws Application',
      'Cross-topic Application'
    ]
  }
];

// ─────────────────────────────────────────────────────────────────────────────
// SYLLABUS
// ─────────────────────────────────────────────────────────────────────────────

app.get('/api/syllabus', (req, res) => {
  res.json(SYLLABUS);
});

// ─────────────────────────────────────────────────────────────────────────────
// QUESTIONS
// ─────────────────────────────────────────────────────────────────────────────

app.get('/api/questions', (req, res) => {
  try {
    const {
      topic,
      subtopic,
      difficulty,
      limit = 10,
      exclude
    } = req.query;

    let sql = 'SELECT * FROM questions WHERE 1=1';
    const params = [];

    if (topic) {
      sql += ' AND topic = ?';
      params.push(topic);
    }

    if (subtopic) {
      sql += ' AND subtopic = ?';
      params.push(subtopic);
    }

    if (difficulty) {
      sql += ' AND difficulty = ?';
      params.push(parseInt(difficulty, 10));
    }

    if (exclude) {
      const ids = exclude
        .split(',')
        .map(Number)
        .filter(Boolean);

      if (ids.length) {
        sql += ` AND id NOT IN (${ids.map(() => '?').join(',')})`;
        params.push(...ids);
      }
    }

    const safeLimit = Math.max(
      1,
      Math.min(parseInt(limit, 10) || 10, 100)
    );

    sql += ' ORDER BY RANDOM() LIMIT ?';
    params.push(safeLimit);

    const questions = db.prepare(sql).all(...params);

    const safe = questions.map(q => ({
      ...q,
      correct_answer: undefined
    }));

    res.json(safe);
  } catch (error) {
    console.error('Questions error:', error);
    res.status(500).json({
      error: 'Unable to load questions'
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ANSWER
// ─────────────────────────────────────────────────────────────────────────────

app.post('/api/answer', (req, res) => {
  try {
    const {
      question_id,
      selected_answer,
      mock_id,
      time_taken
    } = req.body;

    const sessionId = req.session.userId;

    const question = db
      .prepare('SELECT * FROM questions WHERE id = ?')
      .get(question_id);

    if (!question) {
      return res.status(404).json({
        error: 'Question not found'
      });
    }

    const is_correct =
      selected_answer === question.correct_answer ? 1 : 0;

    let marks_earned = 0;

    if (selected_answer) {
      marks_earned = is_correct
        ? question.marks
        : -(question.marks * 0.25);
    }

    const error_type =
      !is_correct && selected_answer
        ? detectErrorType(question, selected_answer)
        : null;

    db.prepare(`
      INSERT INTO attempts (
        session_id,
        question_id,
        mock_id,
        selected_answer,
        is_correct,
        marks_earned,
        time_taken,
        topic,
        subtopic,
        difficulty,
        error_type
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      sessionId,
      question_id,
      mock_id || null,
      selected_answer,
      is_correct,
      marks_earned,
      time_taken || 0,
      question.topic,
      question.subtopic,
      question.difficulty,
      error_type
    );

    updateWeakArea(
      sessionId,
      question,
      is_correct,
      error_type
    );

    res.json({
      correct: is_correct === 1,
      correct_answer: question.correct_answer,
      explanation: question.explanation,
      marks_earned,
      error_type
    });
  } catch (error) {
    console.error('Answer error:', error);

    res.status(500).json({
      error: 'Unable to submit answer'
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ERROR DETECTION
// ─────────────────────────────────────────────────────────────────────────────

function detectErrorType(question, selected) {
  const topic = (question.topic || '').toLowerCase();
  const subtopic = (question.subtopic || '').toLowerCase();
  const tags = (question.tags || '').toLowerCase();
  const questionText = (question.question || '').toLowerCase();

  if (
    topic.includes('case law') ||
    tags.includes('caselaw') ||
    topic.includes('case studies')
  ) {
    return 'case_law_recall';
  }

  if (
    questionText.includes('section') ||
    tags.includes('section')
  ) {
    return 'provision_recall';
  }

  if (
    question.difficulty === 3 ||
    topic.includes('case studies')
  ) {
    return 'application';
  }

  if (question.difficulty === 2) {
    return 'conceptual';
  }

  if (question.difficulty === 1) {
    return 'factual';
  }

  if (
    questionText.includes('calculate') ||
    questionText.includes('rs.') ||
    questionText.includes('crore')
  ) {
    return 'calculation';
  }

  return 'application';
}

// ─────────────────────────────────────────────────────────────────────────────
// WEAK AREAS
// ─────────────────────────────────────────────────────────────────────────────

function updateWeakArea(
  sessionId,
  question,
  is_correct,
  error_type
) {
  try {
    const existing = db
      .prepare(`
        SELECT *
        FROM weak_areas
        WHERE session_id = ?
        AND topic = ?
        AND subtopic = ?
      `)
      .get(
        sessionId,
        question.topic,
        question.subtopic || ''
      );

    if (existing) {
      const newCorrect =
        existing.correct + (is_correct ? 1 : 0);

      const newAttempts =
        existing.attempts + 1;

      const score =
        Math.round((newCorrect / newAttempts) * 100);

      const consecutiveErrors =
        is_correct
          ? 0
          : (existing.consecutive_errors || 0) + 1;

      let weaknessType =
        error_type || existing.weakness_type;

      if (
        consecutiveErrors >= 3 &&
        score < 40
      ) {
        weaknessType =
          'critical_' + weaknessType;
      }

      db.prepare(`
        UPDATE weak_areas
        SET
          attempts = ?,
          correct = ?,
          score = ?,
          weakness_type = ?,
          consecutive_errors = ?,
          last_updated = strftime('%s','now')
        WHERE id = ?
      `).run(
        newAttempts,
        newCorrect,
        score,
        weaknessType,
        consecutiveErrors,
        existing.id
      );
    } else {
      db.prepare(`
        INSERT INTO weak_areas (
          session_id,
          topic,
          subtopic,
          weakness_type,
          score,
          attempts,
          correct,
          consecutive_errors
        )
        VALUES (?, ?, ?, ?, ?, 1, ?, ?)
      `).run(
        sessionId,
        question.topic,
        question.subtopic || '',
        error_type || 'unknown',
        is_correct ? 100 : 0,
        is_correct ? 1 : 0,
        is_correct ? 0 : 1
      );
    }
  } catch (error) {
    console.error(
      'Error updating weak area:',
      error
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MOCK TEST
// ─────────────────────────────────────────────────────────────────────────────

app.post('/api/mock/start', (req, res) => {
  try {
    const {
      type = 'full',
      topic,
      num_questions
    } = req.body;

    const sessionId = req.session.userId;
    const mockId = uuidv4();

    let questions = [];

    const requestedQuestions =
      Math.max(
        1,
        Math.min(
          parseInt(num_questions, 10) || 15,
          100
        )
      );

    const duration =
      type === 'full'
        ? 7200
        : type === 'quick'
          ? 1800
          : 3600;

    if (type === 'full') {
      questions = buildFullMock();
    } else if (type === 'topic' && topic) {
      questions = db
        .prepare(`
          SELECT id, marks
          FROM questions
          WHERE topic = ?
          ORDER BY RANDOM()
          LIMIT ?
        `)
        .all(topic, requestedQuestions);
    } else if (type === 'case-study') {
      questions = db
        .prepare(`
          SELECT id, marks
          FROM questions
          WHERE topic = 'Case Studies'
          ORDER BY RANDOM()
          LIMIT ?
        `)
        .all(requestedQuestions);
    } else if (type === 'case-law') {
      questions =
        buildCaseLawQuiz(requestedQuestions);
    } else {
      questions = db
        .prepare(`
          SELECT id, marks
          FROM questions
          ORDER BY RANDOM()
          LIMIT ?
        `)
        .all(requestedQuestions);
    }

    if (questions.length === 0) {
      return res.status(400).json({
        error: 'No questions available'
      });
    }

    const maxMarks = questions.reduce(
      (sum, q) => sum + (q.marks || 1),
      0
    );

    db.prepare(`
      INSERT INTO mocks (
        id,
        session_id,
        type,
        status,
        questions,
        start_time,
        duration,
        max_marks
      )
      VALUES (
        ?,
        ?,
        ?,
        'active',
        ?,
        strftime('%s','now'),
        ?,
        ?
      )
    `).run(
      mockId,
      sessionId,
      type,
      JSON.stringify(
        questions.map(q => q.id)
      ),
      duration,
      maxMarks
    );

    const fullQuestions = questions
      .map(q => {
        return db
          .prepare(`
            SELECT
              id,
              topic,
              subtopic,
              difficulty,
              type,
              question,
              option_a,
              option_b,
              option_c,
              option_d,
              marks
            FROM questions
            WHERE id = ?
          `)
          .get(q.id);
      })
      .filter(Boolean);

    res.json({
      mock_id: mockId,
      questions: fullQuestions,
      duration,
      max_marks: maxMarks,
      type
    });
  } catch (error) {
    console.error('Mock start error:', error);

    res.status(500).json({
      error: 'Unable to start mock test'
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// FULL MOCK BUILDER
// ─────────────────────────────────────────────────────────────────────────────

function buildFullMock() {
  const result = [];

  const csQ = db
    .prepare(`
      SELECT id, marks
      FROM questions
      WHERE topic = 'Case Studies'
      ORDER BY RANDOM()
      LIMIT 17
    `)
    .all();

  result.push(...csQ);

  const clQ = db
    .prepare(`
      SELECT id, marks
      FROM questions
      WHERE topic IN ('IBC')
      AND tags LIKE '%CaseLaw%'
      ORDER BY RANDOM()
      LIMIT 3
    `)
    .all();

  result.push(...clQ);

  const ibcQ = db
    .prepare(`
      SELECT id, marks
      FROM questions
      WHERE topic = 'IBC'
      AND difficulty <= 2
      ORDER BY RANDOM()
      LIMIT 4
    `)
    .all();

  result.push(...ibcQ);

  const rulesQ = db
    .prepare(`
      SELECT id, marks
      FROM questions
      WHERE topic = 'Rules & Regulations'
      ORDER BY RANDOM()
      LIMIT 4
    `)
    .all();

  result.push(...rulesQ);

  const blQ = db
    .prepare(`
      SELECT id, marks
      FROM questions
      WHERE topic = 'Business Laws'
      ORDER BY RANDOM()
      LIMIT 4
    `)
    .all();

  result.push(...blQ);

  const glQ = db
    .prepare(`
      SELECT id, marks
      FROM questions
      WHERE topic = 'General Laws'
      ORDER BY RANDOM()
      LIMIT 4
    `)
    .all();

  result.push(...glQ);

  const allIBC = db
    .prepare(`
      SELECT id, marks
      FROM questions
      WHERE topic IN (
        'IBC',
        'Finance & Accounts',
        'General Awareness'
      )
      ORDER BY RANDOM()
      LIMIT 5
    `)
    .all();

  result.push(...allIBC);

  return result.sort(
    () => Math.random() - 0.5
  );
}

function buildCaseLawQuiz(n) {
  return db
    .prepare(`
      SELECT id, marks
      FROM questions
      WHERE topic IN ('IBC', 'Case Studies')
      ORDER BY RANDOM()
      LIMIT ?
    `)
    .all(n);
}

// ─────────────────────────────────────────────────────────────────────────────
// GET MOCK STATE
// ─────────────────────────────────────────────────────────────────────────────

app.get('/api/mock/:mockId', (req, res) => {
  try {
    const mock = db
      .prepare(`
        SELECT *
        FROM mocks
        WHERE id = ?
        AND session_id = ?
      `)
      .get(
        req.params.mockId,
        req.session.userId
      );

    if (!mock) {
      return res.status(404).json({
        error: 'Mock not found'
      });
    }

    const questionIds =
      JSON.parse(mock.questions);

    const answers =
      JSON.parse(mock.answers || '{}');

    const questions = questionIds
      .map(id => {
        return db
          .prepare(`
            SELECT
              id,
              topic,
              subtopic,
              difficulty,
              type,
              question,
              option_a,
              option_b,
              option_c,
              option_d,
              marks
            FROM questions
            WHERE id = ?
          `)
          .get(id);
      })
      .filter(Boolean);

    const elapsed =
      mock.start_time
        ? Math.floor(Date.now() / 1000) -
          mock.start_time
        : 0;

    const remaining =
      Math.max(
        0,
        mock.duration - elapsed
      );

    res.json({
      ...mock,
      questions,
      answers,
      remaining,
      elapsed
    });
  } catch (error) {
    console.error(
      'Mock state error:',
      error
    );

    res.status(500).json({
      error: 'Unable to load mock'
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SUBMIT MOCK ANSWER
// ─────────────────────────────────────────────────────────────────────────────

app.post('/api/mock/:mockId/answer', (req, res) => {
  try {
    const {
      question_id,
      selected_answer,
      time_taken
    } = req.body;

    const sessionId =
      req.session.userId;

    const mock = db
      .prepare(`
        SELECT *
        FROM mocks
        WHERE id = ?
        AND session_id = ?
      `)
      .get(
        req.params.mockId,
        sessionId
      );

    if (!mock) {
      return res.status(404).json({
        error: 'Mock not found'
      });
    }

    if (mock.status !== 'active') {
      return res.status(400).json({
        error: 'Mock is not active'
      });
    }

    const elapsed =
      Math.floor(Date.now() / 1000) -
      mock.start_time;

    if (elapsed > mock.duration) {
      return res.status(400).json({
        error: 'Time expired'
      });
    }

    const answers =
      JSON.parse(mock.answers || '{}');

    if (
      answers[question_id] !== undefined
    ) {
      return res.json({
        already_answered: true
      });
    }

    answers[question_id] =
      selected_answer;

    db.prepare(`
      UPDATE mocks
      SET answers = ?
      WHERE id = ?
    `).run(
      JSON.stringify(answers),
      mock.id
    );

    const question = db
      .prepare(
        'SELECT * FROM questions WHERE id = ?'
      )
      .get(question_id);

    if (question) {
      const is_correct =
        selected_answer ===
        question.correct_answer
          ? 1
          : 0;

      let marks_earned = 0;

      if (selected_answer) {
        marks_earned =
          is_correct
            ? question.marks
            : -(question.marks * 0.25);
      }

      const error_type =
        !is_correct && selected_answer
          ? detectErrorType(
              question,
              selected_answer
            )
          : null;

      db.prepare(`
        INSERT INTO attempts (
          session_id,
          question_id,
          mock_id,
          selected_answer,
          is_correct,
          marks_earned,
          time_taken,
          topic,
          subtopic,
          difficulty,
          error_type
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        sessionId,
        question_id,
        mock.id,
        selected_answer,
        is_correct,
        marks_earned,
        time_taken || 0,
        question.topic,
        question.subtopic,
        question.difficulty,
        error_type
      );

      updateWeakArea(
        sessionId,
        question,
        is_correct,
        error_type
      );
    }

    res.json({
      saved: true,
      answered: Object.keys(answers).length
    });
  } catch (error) {
    console.error(
      'Mock answer error:',
      error
    );

    res.status(500).json({
      error: 'Unable to save answer'
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// FINISH MOCK
// ─────────────────────────────────────────────────────────────────────────────

app.post('/api/mock/:mockId/finish', (req, res) => {
  try {
    const sessionId =
      req.session.userId;

    const mock = db
      .prepare(`
        SELECT *
        FROM mocks
        WHERE id = ?
        AND session_id = ?
      `)
      .get(
        req.params.mockId,
        sessionId
      );

    if (!mock) {
      return res.status(404).json({
        error: 'Mock not found'
      });
    }

    const answers =
      JSON.parse(mock.answers || '{}');

    const questionIds =
      JSON.parse(mock.questions);

    let totalMarks = 0;
    const details = [];

    for (const qId of questionIds) {
      const question = db
        .prepare(
          'SELECT * FROM questions WHERE id = ?'
        )
        .get(qId);

      if (!question) continue;

      const selected =
        answers[qId];

      let marks = 0;

      const is_correct =
        selected ===
        question.correct_answer;

      if (selected) {
        marks =
          is_correct
            ? question.marks
            : -(question.marks * 0.25);
      }

      totalMarks += marks;

      details.push({
        id: qId,
        topic: question.topic,
        correct: is_correct,
        marks_earned: marks,
        selected,
        correct_answer:
          question.correct_answer,
        explanation:
          question.explanation,
        question:
          question.question
      });
    }

    db.prepare(`
      UPDATE mocks
      SET
        status = 'completed',
        end_time = strftime('%s','now'),
        total_marks = ?
      WHERE id = ?
    `).run(
      totalMarks,
      mock.id
    );

    const percentage =
      mock.max_marks > 0
        ? (
            (totalMarks / mock.max_marks) *
            100
          ).toFixed(1)
        : '0.0';

    res.json({
      total_marks: totalMarks,
      max_marks: mock.max_marks,
      details,
      percentage
    });
  } catch (error) {
    console.error(
      'Mock finish error:',
      error
    );

    res.status(500).json({
      error: 'Unable to finish mock'
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────

app.get('/api/dashboard', (req, res) => {
  try {
    const sid =
      req.session.userId;

    const totalAttempts =
      db.prepare(`
        SELECT COUNT(*) as c
        FROM attempts
        WHERE session_id = ?
      `).get(sid).c;

    const correctAttempts =
      db.prepare(`
        SELECT COUNT(*) as c
        FROM attempts
        WHERE session_id = ?
        AND is_correct = 1
      `).get(sid).c;

    const totalMarks =
      db.prepare(`
        SELECT COALESCE(
          SUM(marks_earned), 0
        ) as s
        FROM attempts
        WHERE session_id = ?
      `).get(sid).s;

    const mocksDone =
      db.prepare(`
        SELECT COUNT(*) as c
        FROM mocks
        WHERE session_id = ?
        AND status = 'completed'
      `).get(sid).c;

    const topicPerf =
      db.prepare(`
        SELECT
          topic,
          COUNT(*) as attempts,
          SUM(is_correct) as correct,
          ROUND(
            100.0 * SUM(is_correct) /
            COUNT(*),
            1
          ) as accuracy
        FROM attempts
        WHERE session_id = ?
        GROUP BY topic
        ORDER BY accuracy ASC
      `).all(sid);

    const weakAreas =
      db.prepare(`
        SELECT
          topic,
          subtopic,
          score,
          attempts,
          weakness_type
        FROM weak_areas
        WHERE session_id = ?
        AND attempts >= 1
        ORDER BY score ASC
        LIMIT 8
      `).all(sid);

    const recentMocks =
      db.prepare(`
        SELECT
          id,
          type,
          total_marks,
          max_marks,
          status,
          created_at,
          ROUND(
            100.0 * total_marks /
            max_marks,
            1
          ) as percentage
        FROM mocks
        WHERE session_id = ?
        ORDER BY created_at DESC
        LIMIT 5
      `).all(sid);

    const examDate =
      new Date('2025-06-15');

    const daysLeft =
      Math.max(
        0,
        Math.ceil(
          (examDate - new Date()) /
          (1000 * 60 * 60 * 24)
        )
      );

    res.json({
      total_attempts: totalAttempts,
      correct_attempts: correctAttempts,
      accuracy:
        totalAttempts > 0
          ? (
              (correctAttempts /
                totalAttempts) *
              100
            ).toFixed(1)
          : 0,
      total_marks_earned:
        parseFloat(
          totalMarks.toFixed(2)
        ),
      mocks_completed:
        mocksDone,
      topic_performance:
        topicPerf,
      weak_areas:
        weakAreas,
      recent_mocks:
        recentMocks,
      days_to_exam:
        daysLeft,
      readiness:
        calcReadiness(
          correctAttempts,
          totalAttempts,
          weakAreas
        )
    });
  } catch (error) {
    console.error(
      'Dashboard error:',
      error
    );

    res.status(500).json({
      error: 'Unable to load dashboard'
    });
  }
});

function calcReadiness(
  correct,
  total,
  weakAreas
) {
  if (total < 10) {
    return 'Insufficient Data';
  }

  const accuracy =
    (correct / total) * 100;

  const criticalWeaks =
    weakAreas.filter(
      w => w.score < 50
    ).length;

  if (
    accuracy >= 75 &&
    criticalWeaks === 0
  ) {
    return 'Exam Ready';
  }

  if (
    accuracy >= 60 &&
    criticalWeaks <= 2
  ) {
    return 'Almost Ready';
  }

  if (accuracy >= 45) {
    return 'Needs Improvement';
  }

  return 'Significant Gaps';
}

// ─────────────────────────────────────────────────────────────────────────────
// CASE LAWS
// ─────────────────────────────────────────────────────────────────────────────

app.get('/api/case-laws', (req, res) => {
  try {
    const {
      search,
      topic
    } = req.query;

    let sql =
      'SELECT * FROM case_laws WHERE 1=1';

    const params = [];

    if (search) {
      sql += `
        AND (
          case_name LIKE ?
          OR facts LIKE ?
          OR exam_principle LIKE ?
        )
      `;

      params.push(
        `%${search}%`,
        `%${search}%`,
        `%${search}%`
      );
    }

    if (topic) {
      sql +=
        ' AND topic = ?';

      params.push(topic);
    }

    sql +=
      ' ORDER BY year DESC';

    res.json(
      db.prepare(sql).all(...params)
    );
  } catch (error) {
    console.error(
      'Case laws error:',
      error
    );

    res.status(500).json({
      error: 'Unable to load case laws'
    });
  }
});

app.get('/api/case-laws/:id', (req, res) => {
  try {
    const cl =
      db.prepare(
        'SELECT * FROM case_laws WHERE id = ?'
      ).get(req.params.id);

    if (!cl) {
      return res.status(404).json({
        error: 'Not found'
      });
    }

    res.json(cl);
  } catch (error) {
    console.error(
      'Case law detail error:',
      error
    );

    res.status(500).json({
      error: 'Unable to load case law'
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// CASE STUDIES
// ─────────────────────────────────────────────────────────────────────────────

app.get('/api/case-studies', (req, res) => {
  try {
    const studies =
      db.prepare(`
        SELECT
          id,
          title,
          topic,
          difficulty
        FROM case_studies
        ORDER BY id
      `).all();

    res.json(studies);
  } catch (error) {
    console.error(
      'Case studies error:',
      error
    );

    res.status(500).json({
      error: 'Unable to load case studies'
    });
  }
});

app.get('/api/case-studies/:id', (req, res) => {
  try {
    const cs =
      db.prepare(
        'SELECT * FROM case_studies WHERE id = ?'
      ).get(req.params.id);

    if (!cs) {
      return res.status(404).json({
        error: 'Not found'
      });
    }

    const questions =
      db.prepare(`
        SELECT
          id,
          question,
          option_a,
          option_b,
          option_c,
          option_d,
          marks
        FROM case_study_questions
        WHERE case_study_id = ?
      `).all(cs.id);

    res.json({
      ...cs,
      questions
    });
  } catch (error) {
    console.error(
      'Case study detail error:',
      error
    );

    res.status(500).json({
      error: 'Unable to load case study'
    });
  }
});

app.post(
  '/api/case-studies/:id/answer',
  (req, res) => {
    try {
      const {
        question_id,
        selected_answer
      } = req.body;

      const sessionId =
        req.session.userId;

      const q =
        db.prepare(`
          SELECT *
          FROM case_study_questions
          WHERE id = ?
        `).get(question_id);

      if (!q) {
        return res.status(404).json({
          error: 'Not found'
        });
      }

      const is_correct =
        selected_answer ===
        q.correct_answer
          ? 1
          : 0;

      const marks =
        is_correct
          ? q.marks
          : -(q.marks * 0.25);

      db.prepare(`
        INSERT INTO attempts (
          session_id,
          question_id,
          selected_answer,
          is_correct,
          marks_earned,
          topic,
          subtopic,
          difficulty,
          error_type
        )
        VALUES (
          ?,
          ?,
          ?,
          ?,
          ?,
          'Case Studies',
          ?,
          3,
          ?
        )
      `).run(
        sessionId,
        question_id,
        selected_answer,
        is_correct,
        marks,
        'CIRP',
        is_correct
          ? null
          : 'application'
      );

      res.json({
        correct:
          is_correct === 1,
        correct_answer:
          q.correct_answer,
        explanation:
          q.explanation,
        marks_earned:
          marks
      });
    } catch (error) {
      console.error(
        'Case study answer error:',
        error
      );

      res.status(500).json({
        error:
          'Unable to submit case study answer'
      });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// WEAK AREAS
// ─────────────────────────────────────────────────────────────────────────────

app.get('/api/weak-areas', (req, res) => {
  try {
    const sid =
      req.session.userId;

    const areas =
      db.prepare(`
        SELECT
          topic,
          subtopic,
          score,
          attempts,
          correct,
          weakness_type,
          last_updated
        FROM weak_areas
        WHERE session_id = ?
        ORDER BY score ASC
      `).all(sid);

    res.json(areas);
  } catch (error) {
    console.error(
      'Weak areas error:',
      error
    );

    res.status(500).json({
      error: 'Unable to load weak areas'
    });
  }
});

app.get(
  '/api/weak-areas/practice',
  (req, res) => {
    try {
      const sid =
        req.session.userId;

      const weakTopics =
        db.prepare(`
          SELECT
            topic,
            subtopic,
            weakness_type,
            consecutive_errors,
            score
          FROM weak_areas
          WHERE session_id = ?
          AND score < 60
          ORDER BY
            score ASC,
            consecutive_errors DESC
          LIMIT 5
        `).all(sid);

      if (weakTopics.length === 0) {
        const qs =
          db.prepare(`
            SELECT
              id,
              topic,
              subtopic,
              difficulty,
              type,
              question,
              option_a,
              option_b,
              option_c,
              option_d,
              marks
            FROM questions
            ORDER BY RANDOM()
            LIMIT 5
          `).all();

        return res.json(qs);
      }

      const questions = [];

      for (const wt of weakTopics) {
        const limit =
          wt.consecutive_errors >= 3
            ? 5
            : 3;

        let sql = `
          SELECT
            id,
            topic,
            subtopic,
            difficulty,
            type,
            question,
            option_a,
            option_b,
            option_c,
            option_d,
            marks
          FROM questions
          WHERE topic = ?
        `;

        const params = [
          wt.topic
        ];

        if (wt.score < 30) {
          sql +=
            ' AND difficulty <= 2';
        } else if (wt.score < 50) {
          sql +=
            ' AND difficulty <= 3';
        }

        sql +=
          ' ORDER BY RANDOM() LIMIT ?';

        params.push(limit);

        const qs =
          db.prepare(sql).all(...params);

        questions.push(...qs);
      }

      res.json(
        questions.slice(0, 10)
      );
    } catch (error) {
      console.error(
        'Weak practice error:',
        error
      );

      res.status(500).json({
        error:
          'Unable to load practice questions'
      });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// STUDY RECOMMENDATIONS
// ─────────────────────────────────────────────────────────────────────────────

app.get(
  '/api/study/recommendations',
  (req, res) => {
    try {
      const sid =
        req.session.userId;

      const weakAreas =
        db.prepare(`
          SELECT
            topic,
            subtopic,
            weakness_type,
            score,
            consecutive_errors
          FROM weak_areas
          WHERE session_id = ?
          AND score < 60
          ORDER BY
            score ASC,
            consecutive_errors DESC
          LIMIT 3
        `).all(sid);

      const recommendations = [];

      for (const wa of weakAreas) {
        let recommendation = '';
        let priority = 'medium';

        if (
          wa.consecutive_errors >= 3 ||
          wa.score < 30
        ) {
          priority = 'high';
        }

        switch (wa.weakness_type) {
          case 'case_law_recall':
            recommendation =
              `Review key case laws for ${wa.topic}. Focus on case names, court, year, and exam principles. Use the Case Laws tab for targeted study.`;
            break;

          case 'provision_recall':
            recommendation =
              `Memorize key sections and provisions for ${wa.topic}. Create section-wise notes and practice recall. Focus on ${wa.subtopic || 'core provisions'}.`;
            break;

          case 'application':
            recommendation =
              `Practice scenario-based questions for ${wa.topic}. Focus on applying provisions to real-world situations. Case studies will help improve application skills.`;
            break;

          case 'conceptual':
            recommendation =
              `Strengthen conceptual understanding of ${wa.topic}. Study the underlying principles and logic behind provisions. Review case laws that explain concepts.`;
            break;

          case 'factual':
            recommendation =
              `Review basic facts and definitions for ${wa.topic}. Create flashcards for key terms, definitions, and procedural aspects.`;
            break;

          case 'calculation':
            recommendation =
              `Practice numerical problems for ${wa.topic}. Focus on liquidation waterfall calculations, time limits, and quantitative aspects.`;
            break;

          default:
            recommendation =
              `Practice more questions on ${wa.topic} ${wa.subtopic ? 'specifically ' + wa.subtopic : ''}. Review explanations for wrong answers.`;
        }

        recommendations.push({
          topic: wa.topic,
          subtopic: wa.subtopic,
          weakness_type:
            wa.weakness_type,
          score: wa.score,
          priority,
          recommendation
        });
      }

      if (
        recommendations.length === 0
      ) {
        const totalAttempts =
          db.prepare(`
            SELECT COUNT(*) as c
            FROM attempts
            WHERE session_id = ?
          `).get(sid).c;

        if (totalAttempts < 20) {
          recommendations.push({
            topic: 'General',
            subtopic: 'Foundation',
            weakness_type:
              'insufficient_data',
            score: 0,
            priority: 'low',
            recommendation:
              'Complete more questions across all topics to establish a baseline and identify your strengths and weaknesses.'
          });
        } else {
          recommendations.push({
            topic: 'General',
            subtopic: 'Maintenance',
            weakness_type:
              'good_performance',
            score: 100,
            priority: 'low',
            recommendation:
              'Your performance is good! Focus on maintaining accuracy across all topics and take full mock tests to build exam stamina.'
          });
        }
      }

      res.json(recommendations);
    } catch (error) {
      console.error(
        'Recommendations error:',
        error
      );

      res.status(500).json({
        error:
          'Unable to load recommendations'
      });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// HISTORY
// ─────────────────────────────────────────────────────────────────────────────

app.get('/api/history', (req, res) => {
  try {
    const sid =
      req.session.userId;

    const attempts =
      db.prepare(`
        SELECT
          a.*,
          q.question,
          q.topic,
          q.subtopic
        FROM attempts a
        LEFT JOIN questions q
          ON a.question_id = q.id
        WHERE a.session_id = ?
        ORDER BY a.created_at DESC
        LIMIT 50
      `).all(sid);

    res.json(attempts);
  } catch (error) {
    console.error(
      'History error:',
      error
    );

    res.status(500).json({
      error: 'Unable to load history'
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// AI CHAT
// ─────────────────────────────────────────────────────────────────────────────

app.post('/api/chat', async (req, res) => {
  const { message } = req.body;
  const sessionId =
    req.session.userId;

  if (
    !message ||
    !message.trim()
  ) {
    return res.status(400).json({
      error: 'Message required'
    });
  }

  try {
    db.prepare(`
      INSERT INTO conversations (
        session_id,
        role,
        content
      )
      VALUES (?, ?, ?)
    `).run(
      sessionId,
      'user',
      message
    );

    const history =
      db.prepare(`
        SELECT
          role,
          content
        FROM conversations
        WHERE session_id = ?
        ORDER BY created_at DESC
        LIMIT 12
      `).all(sessionId).reverse();

    const totalAttempts =
      db.prepare(`
        SELECT COUNT(*) as c
        FROM attempts
        WHERE session_id = ?
      `).get(sessionId).c;

    const accuracy =
      totalAttempts > 0
        ? (
            (
              db.prepare(`
                SELECT COUNT(*) as c
                FROM attempts
                WHERE session_id = ?
                AND is_correct = 1
              `).get(sessionId).c /
              totalAttempts
            ) * 100
          ).toFixed(1)
        : 0;

    const weakAreas =
      db.prepare(`
        SELECT
          topic,
          subtopic,
          score,
          weakness_type,
          consecutive_errors
        FROM weak_areas
        WHERE session_id = ?
        AND score < 60
        ORDER BY
          score ASC,
          consecutive_errors DESC
        LIMIT 5
      `).all(sessionId);

    const recentMock =
      db.prepare(`
        SELECT
          total_marks,
          max_marks,
          type
        FROM mocks
        WHERE session_id = ?
        AND status = 'completed'
        ORDER BY created_at DESC
        LIMIT 1
      `).get(sessionId);

    const topicPerf =
      db.prepare(`
        SELECT
          topic,
          COUNT(*) as attempts,
          SUM(is_correct) as correct,
          ROUND(
            100.0 * SUM(is_correct) /
            COUNT(*),
            1
          ) as accuracy
        FROM attempts
        WHERE session_id = ?
        GROUP BY topic
        ORDER BY accuracy ASC
      `).all(sessionId);

    const recentStudy =
      db.prepare(`
        SELECT
          topic,
          subtopic,
          status,
          last_studied
        FROM study_progress
        WHERE session_id = ?
        ORDER BY last_studied DESC
        LIMIT 3
      `).all(sessionId);

    const userContext = `
USER PERFORMANCE ANALYSIS:
- Total attempts: ${totalAttempts} questions
- Overall accuracy: ${accuracy}%
- Recent mock: ${
      recentMock
        ? `${recentMock.type} - ${recentMock.total_marks}/${recentMock.max_marks} marks (${(
            (recentMock.total_marks /
              recentMock.max_marks) *
            100
          ).toFixed(1)}%)`
        : 'No mocks completed yet'
    }

TOPIC PERFORMANCE (sorted by accuracy):
${
  topicPerf.length
    ? topicPerf
        .map(
          t =>
            `- ${t.topic}: ${t.accuracy}% (${t.correct}/${t.attempts} correct)`
        )
        .join('\n')
    : '- No topic performance data yet'
}

WEAK AREAS (critical focus needed):
${
  weakAreas.length > 0
    ? weakAreas
        .map(
          w =>
            `- ${w.topic}${
              w.subtopic
                ? ' (' + w.subtopic + ')'
                : ''
            }: ${w.score}% (${w.weakness_type})${
              w.consecutive_errors >= 3
                ? ' CRITICAL - consecutive errors'
                : ''
            }`
        )
        .join('\n')
    : '- No significant weak areas identified yet'
}

RECENT STUDY ACTIVITY:
${
  recentStudy.length > 0
    ? recentStudy
        .map(
          s =>
            `- ${s.topic}${
              s.subtopic
                ? ' - ' + s.subtopic
                : ''
            }: ${s.status}`
        )
        .join('\n')
    : '- No recent study activity recorded'
}`;

    const systemPrompt = `
You are an expert AI tutor for the IBBI Limited Insolvency Examination (India).

You have deep knowledge of:

- Insolvency and Bankruptcy Code 2016 and all amendments up to 4 February 2025
- IBC Rules and Regulations
- CIRP Regulations
- Liquidation Regulations
- Voluntary Liquidation Regulations
- Pre-Pack Regulations
- Insolvency Professional Regulations
- Insolvency Professional Agency Regulations
- Business Laws
- Companies Act 2013
- Contract Act 1872
- Transfer of Property Act
- Sale of Goods Act
- Partnership Act
- LLP Act
- General Laws
- SARFAESI 2002
- RDDBFI 1993
- Competition Act
- FEMA
- Key insolvency case laws
- Finance and accounts
- Valuation basics
- Ethics and professional conduct

${userContext}

ADAPTIVE TEACHING APPROACH:

1. Focus explanations on the user's weak areas.
2. For topics with accuracy below 60%, provide more detailed explanations and examples.
3. For critical weaknesses, provide step-by-step explanations.
4. Reference relevant case laws.
5. Suggest specific study strategies based on error patterns.
6. Adjust complexity based on the user's performance.
7. Answer the actual question asked instead of giving generic information.
8. If the user asks about a specific section, topic, case law, regulation or scenario, answer that specific subject first.
9. Connect the answer to the IBBI examination where useful.

WHEN EXPLAINING:

- Cite specific section numbers and provisions when applicable.
- Use real-world examples.
- Use relevant case law references.
- Break complex concepts into understandable parts.
- Connect related topics.
- Highlight exam-relevant points.
- Highlight common mistakes and traps.
- Clearly distinguish the legal rule from examples.

STUDY GUIDANCE:

- Create realistic study plans considering weak areas.
- Suggest topics based on actual performance.
- Recommend practice question types.
- Advise time allocation based on syllabus weightage.

APP NAVIGATION:

You can guide users to:

Dashboard
AI Tutor
Syllabus
Mock Test
Case Laws
Case Studies
Weak Areas
Progress
History

EXAM RELEVANCE:

- Keep responses focused on exam preparation.
- Emphasize frequently tested concepts.
- Alert users to common traps.
- Provide memory aids where useful.

IMPORTANT:

Use the legal position specified by the application's knowledge scope:
laws/regulations as they stood on 4 February 2025.
Syllabus effective from 5 May 2025.
`;

    let fullPrompt =
      systemPrompt +
      '\n\n';

    const pastHistory =
      history
        .slice(0, -1)
        .slice(-8);

    for (const h of pastHistory) {
      fullPrompt +=
        `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content}\n\n`;
    }

    fullPrompt +=
      `User: ${message}\n\nAssistant:`;

    const result =
      await Promise.race([
        geminiModel.generateContent(
          fullPrompt
        ),
        new Promise(
          (_, reject) =>
            setTimeout(
              () =>
                reject(
                  new Error('Timeout')
                ),
              28000
            )
        )
      ]);

    const reply =
      result.response.text();

    db.prepare(`
      INSERT INTO conversations (
        session_id,
        role,
        content
      )
      VALUES (?, ?, ?)
    `).run(
      sessionId,
      'assistant',
      reply
    );

    res.json({
      reply
    });
  } catch (err) {
    console.error(
      'Gemini error:',
      err.message
    );

    const weakAreas =
      db.prepare(`
        SELECT
          topic,
          subtopic,
          score,
          weakness_type,
          consecutive_errors
        FROM weak_areas
        WHERE session_id = ?
        AND score < 60
        ORDER BY score ASC
        LIMIT 5
      `).all(sessionId);

    const totalAttempts =
      db.prepare(`
        SELECT COUNT(*) as c
        FROM attempts
        WHERE session_id = ?
      `).get(sessionId).c;

    const fallback =
      generateFallbackResponse(
        message,
        weakAreas,
        totalAttempts
      );

    db.prepare(`
      INSERT INTO conversations (
        session_id,
        role,
        content
      )
      VALUES (?, ?, ?)
    `).run(
      sessionId,
      'assistant',
      fallback
    );

    res.json({
      reply: fallback,
      fallback: true
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// FALLBACK AI RESPONSE
// ─────────────────────────────────────────────────────────────────────────────

function generateFallbackResponse(
  message,
  weakAreas,
  attempts
) {
  const msg =
    message.toLowerCase();

  if (
    msg.includes('section 7') ||
    msg.includes('s7')
  ) {
    return `**Section 7 of IBC — Financial Creditor's Application**

A financial creditor can apply to NCLT under Section 7 when:

- There exists a financial debt.
- The corporate debtor has committed a default.
- The applicable minimum default threshold is satisfied.

On admission, the insolvency process begins and the statutory consequences, including moratorium under Section 14, follow.

**Exam focus:** Understand the difference between financial debt, default, admission and commencement of CIRP.`;
  }

  if (
    msg.includes('moratorium') ||
    msg.includes('section 14')
  ) {
    return `**Moratorium under Section 14 of IBC**

Moratorium is declared by the NCLT upon admission of a CIRP application.

It generally restricts:

1. Institution or continuation of suits/proceedings against the corporate debtor.
2. Transfer or disposal of specified assets.
3. Enforcement of security interests.
4. Recovery of property covered by the statutory provision.

**Exam tip:** Remember that the moratorium is a consequence of admission into CIRP and is distinct from the insolvency commencement date.`;
  }

  if (
    msg.includes('weak') ||
    msg.includes('improve')
  ) {
    if (weakAreas.length > 0) {
      return `Based on your performance, focus on: **${weakAreas
        .map(w => w.topic)
        .join(', ')}**.

These areas currently have accuracy below 60%.

Use the **Weak Areas** tab for targeted practice and review the explanations for incorrect answers.`;
    }

    return `Complete more questions so I can identify your weak areas.

Try a **Topic Test** or **Mock Test** and then check the **Weak Areas** and **Dashboard** tabs.`;
  }

  if (
    msg.includes('waterfall') ||
    msg.includes('section 53') ||
    msg.includes('liquidation')
  ) {
    return `**Section 53 — Liquidation Waterfall**

The liquidation proceeds are distributed according to the statutory priority waterfall under Section 53.

For examination preparation, focus particularly on:

1. Insolvency resolution process costs and liquidation costs.
2. Secured creditors and workmen's dues as provided by the Code.
3. Other employee dues.
4. Unsecured financial creditors.
5. Government dues and remaining secured creditor claims as applicable.
6. Other remaining creditors.
7. Preference shareholders.
8. Equity shareholders.

**Exam tip:** Learn the exact statutory order rather than relying only on a mnemonic.`;
  }

  return `AI is currently offline.

${
  attempts < 10
    ? '🎯 Start with a **Topic Test** to build your foundation.'
    : `📊 You've attempted ${attempts} questions. Check your **Dashboard** for a detailed performance breakdown.`
}

${
  weakAreas.length > 0
    ? `⚠️ Focus on weak areas: **${weakAreas
        .map(w => w.topic)
        .join(', ')}**`
    : '✅ Keep practicing consistently across all topics.'
}

Try asking about a specific IBC section, regulation, case law, case study or concept.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// CHAT HISTORY
// ─────────────────────────────────────────────────────────────────────────────

app.get(
  '/api/chat/history',
  (req, res) => {
    try {
      const history =
        db.prepare(`
          SELECT
            role,
            content,
            created_at
          FROM conversations
          WHERE session_id = ?
          ORDER BY created_at ASC
          LIMIT 50
        `).all(
          req.session.userId
        );

      res.json(history);
    } catch (error) {
      console.error(
        'Chat history error:',
        error
      );

      res.status(500).json({
        error:
          'Unable to load chat history'
      });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// CLEAR CHAT
// ─────────────────────────────────────────────────────────────────────────────

app.delete(
  '/api/chat/history',
  (req, res) => {
    try {
      db.prepare(`
        DELETE FROM conversations
        WHERE session_id = ?
      `).run(
        req.session.userId
      );

      res.json({
        cleared: true
      });
    } catch (error) {
      console.error(
        'Clear chat error:',
        error
      );

      res.status(500).json({
        error:
          'Unable to clear chat history'
      });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// STUDY PROGRESS
// ─────────────────────────────────────────────────────────────────────────────

app.post(
  '/api/study/progress',
  (req, res) => {
    try {
      const {
        topic,
        subtopic,
        status
      } = req.body;

      const sid =
        req.session.userId;

      db.prepare(`
        INSERT INTO study_progress (
          session_id,
          topic,
          subtopic,
          status,
          last_studied
        )
        VALUES (
          ?,
          ?,
          ?,
          ?,
          strftime('%s','now')
        )
        ON CONFLICT(
          session_id,
          topic,
          subtopic
        )
        DO UPDATE SET
          status = ?,
          last_studied =
            strftime('%s','now')
      `).run(
        sid,
        topic,
        subtopic || '',
        status || 'studied',
        status || 'studied'
      );

      res.json({
        saved: true
      });
    } catch (error) {
      console.error(
        'Study progress save error:',
        error
      );

      res.status(500).json({
        error:
          'Unable to save study progress'
      });
    }
  }
);

app.get(
  '/api/study/progress',
  (req, res) => {
    try {
      const progress =
        db.prepare(`
          SELECT *
          FROM study_progress
          WHERE session_id = ?
        `).all(
          req.session.userId
        );

      res.json(progress);
    } catch (error) {
      console.error(
        'Study progress error:',
        error
      );

      res.status(500).json({
        error:
          'Unable to load study progress'
      });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// BASIC HEALTH CHECK
// ─────────────────────────────────────────────────────────────────────────────

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: 'IBBI Adaptive Exam Agent'
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// LOCAL SERVER / VERCEL
// ─────────────────────────────────────────────────────────────────────────────

// Run listen() only when this file is executed directly.
// When Vercel imports the Express app, it will NOT start its own server.
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(
      `\n🚀 IBBI Adaptive Exam Agent running at http://localhost:${PORT}\n`
    );
  });
}

// Export Express app for Vercel
module.exports = app;
```
