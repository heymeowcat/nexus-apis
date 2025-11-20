import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()

app.use(express.json())

// Home route - HTML
app.get('/', (req, res) => {
  res.type('html').send(`
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8"/>
        <title>Nexus APIs</title>
        <link rel="stylesheet" href="/style.css" />
      </head>
      <body>
        <nav>
          <a href="/">Home</a>
          <a href="/about">About</a>
          <a href="/requisitionApproval">Requisition Approval</a>
          <a href="/healthz">Health</a>
        </nav>
        <h1>Welcome to Nexus APIs 🚀</h1>
        <p>This is a minimal example without a database or forms.</p>
        <img src="/logo.png" alt="Logo" width="120" />
      </body>
    </html>
  `)
})

app.get('/about', function (req, res) {
  res.sendFile(path.join(__dirname, '..', 'components', 'about.htm'))
})

// Requisition Approval API
app.post('/requisitionApproval', (req, res) => {
  const { requisitionId, approverId, decision, comments } = req.body

  if (!requisitionId || !approverId || !decision) {
    return res.status(400).json({
      error: 'Missing required fields: requisitionId, approverId, or decision',
    })
  }

  const timestamp = new Date().toISOString()
  let decisionStatus = ''
  let nextApprover = ''
  let message = ''

  if (decision.toLowerCase() === 'approve') {
    decisionStatus = 'Approved'
    nextApprover = 'Director' // Example hierarchy
    message = 'Requisition approved successfully'
  } else if (decision.toLowerCase() === 'reject') {
    decisionStatus = 'Rejected'
    nextApprover = 'None'
    message = 'Requisition rejected'
  } else {
    decisionStatus = 'Error'
    message = 'Invalid decision value'
    return res.status(400).json({
      requisitionId,
      decisionStatus,
      approverId,
      nextApprover: 'None',
      comments: comments || '',
      timestamp,
      message,
    })
  }

  res.json({
    requisitionId,
    decisionStatus,
    approverId,
    nextApprover,
    comments: comments || '',
    timestamp,
    message,
  })
})

// Health check
app.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() })
})

export default app
