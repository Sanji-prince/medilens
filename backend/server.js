require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('MediLens API running');
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.use('/api/family-members', require('./routes/familyMembers'));
app.use('/api/documents', require('./routes/documents'));
app.use('/api/vitals', require('./routes/vitals'));
app.use('/api/medicine', require('./routes/medicine'));
app.use('/api/demo', require('./routes/demo'));

app.listen(PORT, () => {
  console.log(`MediLens API running on port ${PORT}`);
});
