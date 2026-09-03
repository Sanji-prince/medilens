import { jsPDF } from 'jspdf'

const MARGIN = 48
const FOOTER_SPACE = 56
const VITAL_LABELS = {
  blood_pressure: 'Blood Pressure',
  blood_sugar: 'Blood Sugar',
  weight: 'Weight',
}

function sanitize(value) {
  return String(value ?? '')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '')
    .trim()
}

function formatDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'

  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatList(values, fallback = 'None recorded') {
  if (!Array.isArray(values)) return fallback

  const entries = values.map(sanitize).filter(Boolean)
  return entries.length ? entries.join(', ') : fallback
}

function fileNameFor(memberName) {
  const slug = String(memberName || 'member')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'member'

  return `health-summary-${slug}-${new Date().toISOString().slice(0, 10)}.pdf`
}

export function exportHealthSummaryPdf({ member, items, currentMedications }) {
  if (!member) throw new Error('Profile data is unavailable. Please reload and try again.')

  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const contentWidth = pageWidth - MARGIN * 2
  const contentBottom = pageHeight - FOOTER_SPACE
  const timelineItems = Array.isArray(items) ? items : []
  const vitals = timelineItems.filter(item => item.kind === 'vital').slice(0, 5)
  const documents = timelineItems.filter(item => item.kind === 'document').slice(0, 3)
  const medications = Array.isArray(currentMedications) ? currentMedications : []
  let y = MARGIN

  function ensureSpace(height) {
    if (y + height <= contentBottom) return
    doc.addPage()
    y = MARGIN
  }

  function writeParagraph(text, {
    size = 10.5,
    style = 'normal',
    color = [55, 65, 81],
    indent = 0,
    gapAfter = 0,
  } = {}) {
    const lineHeight = size * 1.45
    const lines = doc.splitTextToSize(sanitize(text) || '-', contentWidth - indent)

    doc.setFont('helvetica', style)
    doc.setFontSize(size)
    doc.setTextColor(...color)

    lines.forEach(line => {
      ensureSpace(lineHeight)
      doc.text(line, MARGIN + indent, y)
      y += lineHeight
    })

    y += gapAfter
  }

  function sectionHeading(title) {
    ensureSpace(50)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(29, 78, 216)
    doc.text(title.toUpperCase(), MARGIN, y)
    y += 8
    doc.setDrawColor(191, 219, 254)
    doc.line(MARGIN, y, pageWidth - MARGIN, y)
    y += 17
  }

  function writeBullets(entries, fallback) {
    const values = Array.isArray(entries) ? entries.map(sanitize).filter(Boolean) : []
    if (!values.length) {
      writeParagraph(fallback, { color: [107, 114, 128] })
      return
    }

    values.forEach(value => writeParagraph(`- ${value}`, { indent: 10 }))
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(21)
  doc.setTextColor(30, 64, 175)
  doc.text('Health Summary', MARGIN, y)
  y += 28

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(17, 24, 39)
  doc.text(sanitize(member.name) || 'Family member', MARGIN, y)
  y += 20

  writeParagraph(`Age: ${member.age ?? '-'}`, { size: 10.5, color: [75, 85, 99] })
  writeParagraph(`Generated: ${formatDate(new Date().toISOString())}`, { size: 9.5, color: [107, 114, 128] })
  y += 6
  doc.setDrawColor(191, 219, 254)
  doc.line(MARGIN, y, pageWidth - MARGIN, y)
  y += 22

  sectionHeading('Conditions and Allergies')
  writeParagraph(`Chronic Conditions: ${formatList(member.chronic_conditions)}`, { gapAfter: 6 })
  writeParagraph(`Allergies: ${formatList(member.allergies)}`, { gapAfter: 8 })

  sectionHeading('Current Medications')
  writeBullets(medications, 'None recorded')
  y += 8

  sectionHeading('Recent Vitals (Latest 5)')
  if (!vitals.length) {
    writeParagraph('No vitals recorded', { color: [107, 114, 128] })
  } else {
    vitals.forEach(vital => {
      const label = VITAL_LABELS[vital.type] || sanitize(vital.type) || 'Vital'
      const source = vital.source === 'document' ? ' (from document)' : ''
      writeParagraph(`${formatDate(vital.occurred_at)} - ${label}: ${sanitize(vital.value) || '-'}${source}`, { gapAfter: 3 })
    })
  }
  y += 5

  sectionHeading('Recent Documents (Latest 3)')
  if (!documents.length) {
    writeParagraph('No documents uploaded', { color: [107, 114, 128] })
  } else {
    documents.forEach((document, index) => {
      if (index > 0) y += 7
      writeParagraph(sanitize(document.file_name) || 'Untitled document', { style: 'bold', gapAfter: 2 })
      writeParagraph(`Uploaded: ${formatDate(document.occurred_at)}`, { size: 9.5, color: [107, 114, 128], gapAfter: 3 })

      const summary = document.extracted_summary
      if (!summary || typeof summary !== 'object') {
        writeParagraph('Summary unavailable', { size: 9.5, color: [107, 114, 128] })
        return
      }

      const documentType = sanitize(summary.document_type)
      const documentDate = sanitize(summary.date)
      const findings = Array.isArray(summary.key_findings) ? summary.key_findings.map(sanitize).filter(Boolean) : []
      const drugNames = Array.isArray(summary.mentioned_drug_names) ? summary.mentioned_drug_names.map(sanitize).filter(Boolean) : []

      if (!documentType && !documentDate && !findings.length && !drugNames.length) {
        writeParagraph('Summary unavailable', { size: 9.5, color: [107, 114, 128] })
        return
      }

      if (documentType) {
        writeParagraph(`Type: ${documentType}`, { size: 9.5 })
      }
      if (documentDate) {
        writeParagraph(`Document date: ${documentDate}`, { size: 9.5 })
      }
      if (findings.length) {
        writeBullets(findings, '')
      }
      if (drugNames.length) {
        writeParagraph(`Drugs: ${formatList(drugNames)}`, { size: 9.5 })
      }
    })
  }

  const pageCount = doc.getNumberOfPages()
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(107, 114, 128)
    doc.text('Generated by MediLens - not medical advice', MARGIN, pageHeight - 24)
    doc.text(`Page ${page} of ${pageCount}`, pageWidth - MARGIN, pageHeight - 24, { align: 'right' })
  }

  doc.save(fileNameFor(member.name))
}
